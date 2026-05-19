#!/usr/bin/env python3
"""
ArtMusic Qt - Desktop Shell
Uses PyQt6 WebEngine (Chromium-based) for UI
No WebView2 required - uses Chromium instead
"""

import sys
import os
import json
from pathlib import Path
from PyQt6.QtCore import QUrl, pyqtSignal, QObject, QProcess
from PyQt6.QtWidgets import QApplication, QMainWindow, QMessageBox
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEngineProfile

class BackendProcess(QObject):
    """Manages the Rust backend process"""
    
    # Signals for responses
    response_ready = pyqtSignal(str, object)  # command, result
    
    def __init__(self, backend_path=None):
        super().__init__()
        self.process = QProcess(self)
        self.process.setProgram(sys.executable)
        self.pending_commands = {}
        self.command_id = 0
        
        # Connect signals
        self.process.readyReadStandardOutput.connect(self.on_output)
        self.process.finished.connect(self.on_finished)
        
        # Find backend
        if backend_path:
            self.backend_path = backend_path
        elif getattr(sys, 'frozen', False):
            base_dir = Path(sys._MEIPASS)
            self.backend_path = str(base_dir / "artmusic-windows.exe")
        else:
            self.backend_path = None
    
    def start(self):
        """Start the backend server"""
        print("Backend: Using embedded mode")
    
    def call(self, command, args=None):
        """Call a backend command"""
        req = {"cmd": command, "args": args or {}}
    
    def on_output(self):
        """Handle backend output"""
        data = self.process.readAllStandardOutput()
        try:
            resp = json.loads(data.decode())
            cmd_id = resp.get("id")
            if cmd_id in self.pending_commands:
                self.response_ready.emit(cmd_id, resp.get("result"))
        except:
            pass
    
    def on_finished(self, code):
        """Handle backend exit"""
        print(f"Backend exited with code {code}")

class ArtMusicWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.backend = BackendProcess()
        self.setup_ui()
    
    def setup_ui(self):
        """Set up the main window"""
        self.setWindowTitle("ArtMusic")
        self.resize(1200, 800)
        self.setMinimumSize(900, 600)
        
        # Create web view
        self.view = QWebEngineView()
        self.setCentralWidget(self.view)
        
        # Configure profile
        profile = self.view.page().profile()
        profile.setHttpCacheType(QWebEngineProfile.MemoryHttpCache)
        profile.setPersistentCookiesPolicy(QWebEngineProfile.NoPersistentCookies)
        
        # Handle window close
        self.view.page().windowCloseRequested.connect(self.close)
        
        # Load the app
        self.load_app()
    
    def load_app(self):
        """Load the ArtMusic frontend"""
        # Find the dist folder
        if getattr(sys, 'frozen', False):
            base_dir = Path(sys._MEIPASS)
        else:
            base_dir = Path(__file__).parent
        
        dist_dir = base_dir / "dist"
        
        # Try current working directory
        if not dist_dir.exists():
            dist_dir = Path.cwd() / "dist"
        
        if dist_dir.exists():
            index_html = dist_dir / "index.html"
            if index_html.exists():
                self.view.setUrl(QUrl.fromLocalFile(str(index_html)))
                self.show()
                return
        
        # Try parent directory
        if not dist_dir.exists():
            dist_dir = base_dir.parent / "dist"
        
        index_html = dist_dir / "index.html"
        if index_html.exists():
            self.view.setUrl(QUrl.fromLocalFile(str(index_html)))
            self.show()
        else:
            QMessageBox.critical(
                self, "Error",
                f"Could not find dist/index.html\nSearched in: {base_dir}"
            )
            sys.exit(1)

def main():
    # Enable HiDPI
    QApplication.setHighDpiScaleFactorRoundingPolicy(4)
    
    app = QApplication(sys.argv)
    app.setApplicationName("ArtMusic")
    app.setApplicationVersion("0.1.0")
    app.setOrganizationName("ArtMusic")
    
    # Create main window
    window = ArtMusicWindow()
    
    return app.exec()

if __name__ == "__main__":
    sys.exit(main())