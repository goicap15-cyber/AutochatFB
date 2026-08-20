const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(__dirname, '../../../data');
const MACHINE_FILE = path.join(DATA_DIR, 'machine_id.txt');

function getMachineId() {
  try {
    if (fs.existsSync(MACHINE_FILE)) {
      return fs.readFileSync(MACHINE_FILE, 'utf8').trim();
    }
  } catch (e) {}

  const platform = os.platform();
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model.replace(/\s+/g, '') : 'CPU';
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();

  const machineId = `MAC-${platform.toUpperCase()}-${cpuModel.substring(0, 10)}-${rand}`;

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MACHINE_FILE, machineId, 'utf8');
  } catch (e) {}

  return machineId;
}

module.exports = { getMachineId };
