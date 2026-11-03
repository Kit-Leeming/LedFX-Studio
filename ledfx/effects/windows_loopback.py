"""Capture a Windows playback endpoint for LedFX's existing audio callback."""

import logging
import threading

import numpy as np

_LOGGER = logging.getLogger(__name__)

try:
    import soundcard as sc
except ImportError:  # SoundCard is a Windows-only dependency in this build.
    sc = None


def loopback_devices():
    """Return currently available playback loopbacks in endpoint order."""
    if sc is None:
        return []
    try:
        return [mic for mic in sc.all_microphones(include_loopback=True) if mic.isloopback]
    except Exception as exc:
        _LOGGER.warning("Could not enumerate Windows playback loopbacks: %s", exc)
        return []


class WindowsLoopbackStream:
    """Adapt SoundCard's blocking recorder to sounddevice's stream interface."""

    def __init__(self, endpoint_id, samplerate, frame_count, callback):
        self.endpoint_id = endpoint_id
        self.samplerate = int(samplerate)
        self.frame_count = int(frame_count)
        self.callback = callback
        self._stop = threading.Event()
        self._ready = threading.Event()
        self._thread = None
        self._start_error = None

    def start(self):
        self._stop.clear()
        self._ready.clear()
        self._start_error = None
        self._thread = threading.Thread(
            target=self._capture, name="LedFX-WASAPI-loopback", daemon=True
        )
        self._thread.start()
        if not self._ready.wait(timeout=5):
            self.stop()
            raise OSError("Timed out opening Windows playback loopback")
        if self._start_error:
            self.stop()
            raise OSError("Could not open Windows playback loopback") from self._start_error

    def _capture(self):
        import comtypes

        comtypes.CoInitialize()
        try:
            mic = sc.get_microphone(self.endpoint_id, include_loopback=True)
            if mic is None or not mic.isloopback:
                raise OSError("Playback endpoint is no longer available")
            # SoundCard's Windows backend requires at least two channels for
            # reliable capture. Downmix before passing samples to LedFX.
            with mic.recorder(
                samplerate=self.samplerate,
                channels=[0, 1],
                blocksize=self.frame_count * 2,
            ) as recorder:
                self._ready.set()
                while not self._stop.is_set():
                    samples = recorder.record(numframes=self.frame_count)
                    if len(samples):
                        mono = np.asarray(samples.mean(axis=1), dtype=np.float32)
                        self.callback(mono, len(mono), None, None)
        except Exception as exc:
            if not self._ready.is_set():
                self._start_error = exc
                self._ready.set()
            elif not self._stop.is_set():
                _LOGGER.error("Windows playback loopback stopped: %s", exc)
        finally:
            comtypes.CoUninitialize()

    def stop(self):
        self._stop.set()
        if self._thread and self._thread is not threading.current_thread():
            self._thread.join(timeout=2)

    def close(self):
        self.stop()
