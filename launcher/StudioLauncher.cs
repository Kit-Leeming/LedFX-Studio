using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Windows.Forms;

internal static class StudioLauncher {
    static string Quote(string value) { return "\"" + value + "\""; }
    static bool Ready(string url) {
        try { var req = (HttpWebRequest)WebRequest.Create(url + "/api/studio"); req.Timeout = 1500; req.Proxy = null;
            using (var response = (HttpWebResponse)req.GetResponse()) using(var reader = new StreamReader(response.GetResponseStream())) {
                var result = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
                return result.ContainsKey("library") && result.ContainsKey("virtuals");
            }
        } catch { return false; }
    }
    [STAThread] static void Main(string[] args) {
        try {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string config = Path.Combine(root, "portable-data"), exe = Path.Combine(root, "dist", "LedFx", "LedFx.exe");
            int port = 8888;
            string file = Path.Combine(config, "config.json");
            if(File.Exists(file)) {
                var data = new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(file));
                if(data.ContainsKey("port")) port = Convert.ToInt32(data["port"]);
            }
            if(port < 1 || port > 65535) throw new Exception("Invalid LedFX port in portable-data/config.json.");
            string url = "http://127.0.0.1:" + port;
            using(var mutex = new Mutex(false, "Local\\LedFX_Portable_Starter")) {
                if(!mutex.WaitOne(TimeSpan.FromSeconds(30))) throw new Exception("Another LedFX launch is still starting.");
                try {
                    bool running = false;
                    foreach(var process in Process.GetProcessesByName("LedFx")) {
                        try { if(string.Equals(process.MainModule.FileName, exe, StringComparison.OrdinalIgnoreCase)) running = true; }
                        catch {} finally { process.Dispose(); }
                    }
                    if(!running) {
                        using(var socket = new TcpClient()) {
                            try { var result=socket.BeginConnect("127.0.0.1", port, null, null); if(result.AsyncWaitHandle.WaitOne(500) && socket.Connected) throw new InvalidOperationException("Port " + port + " is used by another application. Close it or change the LedFX port."); }
                            catch(SocketException) {}
                        }
                        if(!File.Exists(exe)) throw new Exception("Portable backend missing: " + exe);
                        Directory.CreateDirectory(config);
                        var start = new ProcessStartInfo(exe, "-c " + Quote(config));
                        start.WorkingDirectory=root;start.UseShellExecute=false;start.CreateNoWindow=true;start.WindowStyle=ProcessWindowStyle.Hidden;
                        Process.Start(start);
                    }
                    bool ready=false;
                    for(int i=0;i<60;i++) { if(Ready(url)){ready=true;break;}Thread.Sleep(500); }
                    if(!ready)throw new Exception("LedFX Studio did not become ready. Check portable-data/ledfx.log. If an older LedFX build is running, close it and launch again.");
                    if(Array.IndexOf(args,"--check")>=0)return;
                    string browser=null;
                    foreach(string candidate in new string[]{
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Microsoft","Edge","Application","msedge.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Google","Chrome","Application","chrome.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Google","Chrome","Application","chrome.exe")}) if(File.Exists(candidate)){browser=candidate;break;}
                    if(browser!=null) {
                        var window = new ProcessStartInfo(browser, "--app=" + Quote(url+"/studio/index.html") + " --user-data-dir=" + Quote(Path.Combine(config,"studio-browser")) + " --no-first-run --disable-background-mode");
                        window.WorkingDirectory=root;window.UseShellExecute=false;window.WindowStyle=ProcessWindowStyle.Hidden;
                        Process.Start(window);
                    } else Process.Start(new ProcessStartInfo(url+"/studio/index.html") {UseShellExecute=true});
                } finally {mutex.ReleaseMutex();}
            }
        } catch(Exception error) { MessageBox.Show(error.Message,"LedFX Studio",MessageBoxButtons.OK,MessageBoxIcon.Error);Environment.ExitCode=1; }
    }
}
