const { writeFile } = require('fs/promises');
async function createZipBuffer(entries) {
  const archiver = (await import('archiver')).default;
  const { PassThrough } = require('stream');

  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', reject);
    archive.pipe(stream);

    for (const [name, content] of entries) {
      archive.append(content, { name });
    }
    archive.finalize();
  });
}

function registerBackupIpc(ipcMain, { getMainWindow, dialog }) {
  ipcMain.handle('backup:export-zip', async (_event, jsonPayload, suggestedName) => {
    const mainWindow = getMainWindow();
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Cultiva backup',
      defaultPath: suggestedName || 'cultiva-backup.zip',
      filters: [{ name: 'ZIP archive', extensions: ['zip'] }]
    });

    if (canceled || !filePath) {
      return { success: false };
    }

    const manifest = typeof jsonPayload === 'string' ? jsonPayload : JSON.stringify(jsonPayload, null, 2);
    let parsed;
    try {
      parsed = JSON.parse(manifest);
    } catch {
      return { success: false, error: 'Invalid backup JSON' };
    }

    const habitsJson = JSON.stringify(parsed.habits ?? [], null, 2);
    const settingsJson = JSON.stringify(parsed.settings ?? {}, null, 2);
    const readme = `Cultiva backup\nExported: ${parsed.exportedAt || new Date().toISOString()}\nVersion: ${parsed.version || 'unknown'}\n\nImport habits.json via Settings → Import (JSON).\n`;

    const zipBuffer = await createZipBuffer([
      ['habits.json', habitsJson],
      ['settings.json', settingsJson],
      ['manifest.json', manifest],
      ['README.txt', readme]
    ]);

    await writeFile(filePath, zipBuffer);
    return { success: true, path: filePath };
  });
}

module.exports = { registerBackupIpc };
