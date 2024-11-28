const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'XML Files', extensions: ['xml'] }]
  });
  if (!canceled) {
    return filePaths[0];
  }
});

ipcMain.handle('transform-xrechnung', async (event, filePath) => {
    const saxonPath = path.join(__dirname, 'lib', 'saxon-he-10.6.jar');
    const xslDir = path.join(__dirname, 'src', 'xsl');
    const tempDir = path.join(__dirname, 'temp');
    
    // Erstelle temp Verzeichnis, falls es nicht existiert
    if (!fs.existsSync(tempDir)){
      fs.mkdirSync(tempDir);
    }
  
    const xrOutputPath = path.join(tempDir, 'output-xr.xml');
    const htmlOutputPath = path.join(__dirname, 'output.html');
    const htmlEnOutputPath = path.join(__dirname, 'output-en.html');
  
    try {
      // Schritt 1: XML zu XR
      await execPromise(`java -cp "${saxonPath}" net.sf.saxon.Transform -s:"${filePath}" -xsl:"${path.join(xslDir, 'ubl-invoice-xr.xsl')}" -o:"${xrOutputPath}"`);
      console.log('Schritt 1 abgeschlossen: XML zu XR');
  
      // Schritt 2: XR zu HTML (Deutsch)
      await execPromise(`java -cp "${saxonPath}" net.sf.saxon.Transform -s:"${xrOutputPath}" -xsl:"${path.join(xslDir, 'xrechnung-html.xsl')}" -o:"${htmlOutputPath}"`);
      console.log('Schritt 2 abgeschlossen: XR zu HTML (Deutsch)');
  
      // Schritt 3: XR zu HTML (Englisch)
      await execPromise(`java -cp "${saxonPath}" net.sf.saxon.Transform -s:"${xrOutputPath}" -xsl:"${path.join(xslDir, 'xrechnung-html.xsl')}" -o:"${htmlEnOutputPath}" lang=en`);
      console.log('Schritt 3 abgeschlossen: XR zu HTML (Englisch)');
  
      // Lese die deutschen und englischen HTML-Inhalte
      const htmlContent = fs.readFileSync(htmlOutputPath, 'utf-8');
      const htmlEnContent = fs.readFileSync(htmlEnOutputPath, 'utf-8');
  
      return { de: htmlContent, en: htmlEnContent };
    } catch (error) {
      console.error('Fehler während der Transformation:', error);
      throw error;
    } finally {
      // Aufräumen: Lösche temporäre Dateien
      if (fs.existsSync(xrOutputPath)) fs.unlinkSync(xrOutputPath);

    }
  });