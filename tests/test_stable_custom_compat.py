"""Compatibility coverage for custom output paths retained across stable upgrades."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np
import sacn

from ledfx.devices.dummy import DummyDevice
from ledfx.devices.e131 import E131Device
from ledfx.devices.wled import WLEDDevice


def test_rgbw_uniform_write_preserves_white_and_emits_rgb_preview():
    device = object.__new__(DummyDevice)
    device._active = True
    device._id = "rgbw"
    device._config = {"center_offset": 0, "name": "RGBW test"}
    device._pixels = np.zeros((2, 4))
    device._ledfx = SimpleNamespace(events=MagicMock())
    device.__dict__["priority_virtual"] = SimpleNamespace(id="virtual")
    device.flush = MagicMock()
    device.update_pixels("virtual", [(np.array([10, 20, 30, 40]), 0, 1)])
    np.testing.assert_array_equal(device._pixels, [[10, 20, 30, 40]] * 2)
    assert device.flush.call_args.args[0].shape == (2, 4)
    assert device._ledfx.events.fire_event.call_args.args[0].pixels.shape == (2, 3)
    device._active = False


def test_white_mode_change_rebuilds_udp_and_resizes_buffer():
    device = object.__new__(WLEDDevice)
    device._active = False
    device._destination = "127.0.0.1"
    device._ledfx = MagicMock()
    device._config = {
        "sync_mode": "UDP",
        "name": "RGBW",
        "ip_address": "127.0.0.1",
        "pixel_count": 2,
        "refresh_rate": 30,
        "rgbw_led": True,
        "independent_white": False,
    }
    device._pixels = np.zeros((2, 3))
    device.device_configs = {"UDP": {}}
    device.subdevice = MagicMock()
    old = device.subdevice
    device._built_settings = device._output_settings()
    device._config["independent_white"] = True
    factory = MagicMock()
    with patch.dict(WLEDDevice.SYNC_MODES, {"UDP": factory}):
        device.config_updated(device._config)
    old.deactivate.assert_called_once()
    assert factory.call_args.args[1]["udp_packet_type"] == "DRGBW"
    assert device._pixels.shape == (2, 4)


def test_two_e131_senders_use_distinct_ephemeral_source_ports():
    devices = []
    try:
        with patch.object(sacn.sACNsender, "start"):
            for universe in [1, 2]:
                config = E131Device.schema()(
                    {
                        "name": f"loopback-{universe}",
                        "ip_address": "127.0.0.1",
                        "pixel_count": 60,
                        "universe": universe,
                    }
                )
                device = E131Device(MagicMock(), config)
                device._destination = "127.0.0.1"
                devices.append(device)
                # No send thread or flush: these sockets send no traffic.
                with patch("ledfx.devices.NetworkedDevice.activate"):
                    device.activate()
            ports = [
                d._sacn._sender_handler.socket._socket.getsockname()[1] for d in devices
            ]
            assert len(set(ports)) == 2
            assert all(port != 5568 for port in ports)
    finally:
        for device in devices:
            if device._sacn:
                device._sacn._sender_handler.socket._socket.close()
                device._sacn = None
