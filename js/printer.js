// Web Bluetooth Printer API for MXW01 and Standard/Cat Printers
import { logger } from './logger.js';

export const PRINTER_WIDTH = 384;
export const PRINTER_WIDTH_BYTES = PRINTER_WIDTH / 8;
export const MIN_DATA_BYTES = 90 * PRINTER_WIDTH_BYTES;

const MAIN_SERVICE_UUID = '0000ae30-0000-1000-8000-00805f9b34fb';
const MAIN_SERVICE_UUID_ALT = '0000af30-0000-1000-8000-00805f9b34fb';
const CONTROL_WRITE_UUID = '0000ae01-0000-1000-8000-00805f9b34fb';
const DATA_WRITE_UUID = '0000ae03-0000-1000-8000-00805f9b34fb';
const NOTIFY_UUID = '0000ae02-0000-1000-8000-00805f9b34fb';

const CommandIDs = { 
  GET_STATUS: 0xA1, 
  GET_BATTERY: 0xAB,
  PRINT: 0xA9, 
  PRINT_COMPLETE: 0xAA 
};

// Known Standard/Blue Printer Models (from NaitLee/Cat-Printer)
const STANDARD_MODELS = [
  'SC03h', 'GB01', 'GB02', 'GB03', 'GT01',
  'MX05', 'MX06', 'MX08', 'MX09', 'MX10',
  'YT01', 'MX11', '_ZZ00'
];

// CRC8 (Dallas/Maxim variant, Polynomial 0x07, Init 0x00) Lookup Table
const CRC8_TABLE = [
  0x00,0x07,0x0E,0x09,0x1C,0x1B,0x12,0x15,0x38,0x3F,0x36,0x31,0x24,0x23,0x2A,0x2D,
  0x70,0x77,0x7E,0x79,0x6C,0x6B,0x62,0x65,0x48,0x4F,0x46,0x41,0x54,0x53,0x5A,0x5D,
  0xE0,0xE7,0xEE,0xE9,0xFC,0xFB,0xF2,0xF5,0xD8,0xDF,0xD6,0xD1,0xC4,0xC3,0xCA,0xCD,
  0x90,0x97,0x9E,0x99,0x8C,0x8B,0x82,0x85,0xA8,0xAF,0xA6,0xA1,0xB4,0xB3,0xBA,0xBD,
  0xC7,0xC0,0xC9,0xCE,0xDB,0xDC,0xD5,0xD2,0xFF,0xF8,0xF1,0xF6,0xE3,0xE4,0xED,0xEA,
  0xB7,0xB0,0xB9,0xBE,0xAB,0xAC,0xA5,0xA2,0x8F,0x88,0x81,0x86,0x93,0x94,0x9D,0x9A,
  0x27,0x20,0x29,0x2E,0x3B,0x3C,0x35,0x32,0x1F,0x18,0x11,0x16,0x03,0x04,0x0D,0x0A,
  0x57,0x50,0x59,0x5E,0x4B,0x4C,0x45,0x42,0x6F,0x68,0x61,0x66,0x73,0x74,0x7D,0x7A,
  0x89,0x8E,0x87,0x80,0x95,0x92,0x9B,0x9C,0xB1,0xB6,0xBF,0xB8,0xAD,0xAA,0xA3,0xA4,
  0xF9,0xFE,0xF7,0xF0,0xE5,0xE2,0xEB,0xEC,0xC1,0xC6,0xCF,0xC8,0xDD,0xDA,0xD3,0xD4,
  0x69,0x6E,0x67,0x60,0x75,0x72,0x7B,0x7C,0x51,0x56,0x5F,0x58,0x4D,0x4A,0x43,0x44,
  0x19,0x1E,0x17,0x10,0x05,0x02,0x0B,0x0C,0x21,0x26,0x2F,0x28,0x3D,0x3A,0x33,0x34,
  0x4E,0x49,0x40,0x47,0x52,0x55,0x5C,0x5B,0x76,0x71,0x78,0x7F,0x6A,0x6D,0x64,0x63,
  0x3E,0x39,0x30,0x37,0x22,0x25,0x2C,0x2B,0x06,0x01,0x08,0x0F,0x1A,0x1D,0x14,0x13,
  0xAE,0xA9,0xA0,0xA7,0xB2,0xB5,0xBC,0xBB,0x96,0x91,0x98,0x9F,0x8A,0x8D,0x84,0x83,
  0xDE,0xD9,0xD0,0xD7,0xC2,0xC5,0xCC,0xCB,0xE6,0xE1,0xE8,0xEF,0xFA,0xFD,0xF4,0xF3
];

function calculateCRC8(data) {
  let crc = 0;
  for (let b of data) crc = CRC8_TABLE[(crc ^ b) & 0xFF];
  return crc;
}

function reverseBits(b) {
  b = ((b & 0xF0) >> 4) | ((b & 0x0F) << 4);
  b = ((b & 0xCC) >> 2) | ((b & 0x33) << 2);
  b = ((b & 0xAA) >> 1) | ((b & 0x55) << 1);
  return b;
}

// Encode a single row of boolean pixels (length PRINTER_WIDTH) into bytes
function encode1bppRow(rowBool) {
  if (rowBool.length !== PRINTER_WIDTH) {
    const error = `Row length must be ${PRINTER_WIDTH}, got ${rowBool.length}`;
    logger.error(error);
    throw new Error(error);
  }
  const rowBytes = new Uint8Array(PRINTER_WIDTH_BYTES);
  for (let byteIndex = 0; byteIndex < PRINTER_WIDTH_BYTES; byteIndex++) {
    let byteVal = 0;
    for (let bit = 0; bit < 8; bit++) {
      if (rowBool[byteIndex * 8 + bit]) {
        byteVal |= 1 << bit;
      }
    }
    rowBytes[byteIndex] = byteVal;
  }
  return rowBytes;
}

// Process canvas to 1bpp boolean array (Shared logic)
function processImageTo1bpp(canvas) {
  const { width, height } = canvas;

  if (width !== PRINTER_WIDTH) {
    throw new Error(`Canvas width ${width} != expected printer width ${PRINTER_WIDTH}`);
  }

  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, width, height).data;
  const rowsBool = [];

  for (let y = 0; y < height; y++) {
    const row = new Array(width).fill(false);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Check Alpha channel (index 3). If transparent (< 128), treat as white (false).
      if (imgData[i+3] < 128) {
        row[x] = false;
        continue;
      }
      // Luminance: 0.299*R + 0.587*G + 0.114*B
      const lum = 0.299 * imgData[i] + 0.587 * imgData[i+1] + 0.114 * imgData[i+2];
      row[x] = lum < 128; // Thresholding
    }
    rowsBool.push(row);
  }
  return rowsBool;
}

// Prepare full image data buffer, pad to MIN_DATA_BYTES
function prepareImageDataBuffer(imageRowsBool) {
  const height = imageRowsBool.length;
  logger.info(`Preparing image data buffer for ${height} rows`, { 
    width: PRINTER_WIDTH, 
    bytesPerRow: PRINTER_WIDTH_BYTES,
    minBytes: MIN_DATA_BYTES 
  });
  
  let buffer = new Uint8Array(0);
  for (let y = 0; y < height; y++) {
    const rowBytes = encode1bppRow(imageRowsBool[y]);
    const newBuf = new Uint8Array(buffer.length + rowBytes.length);
    newBuf.set(buffer);
    newBuf.set(rowBytes, buffer.length);
    buffer = newBuf;
    
    if (y % 50 === 0 || y === height - 1) {
      logger.setProgress(Math.round((y+1)/height*50)); // First 50% of progress is encoding
    }
  }
  
  // Check if padding is needed
  if (buffer.length < MIN_DATA_BYTES) {
    logger.info(`Padding buffer to minimum size: ${buffer.length} -> ${MIN_DATA_BYTES} bytes`);
    const pad = new Uint8Array(MIN_DATA_BYTES - buffer.length);
    const newBuf = new Uint8Array(buffer.length + pad.length);
    newBuf.set(buffer);
    newBuf.set(pad, buffer.length);
    buffer = newBuf;
  }
  
  return buffer;
}

class MXW01Driver {
  constructor(device, server, controlChar, dataChar, notifyChar) {
    this.device = device;
    this.server = server;
    this.controlChar = controlChar;
    this.dataChar = dataChar;
    this.notifyChar = notifyChar;
    this.pendingResolvers = new Map();
    this.lastKnownBatteryLevel = null;

    // Bind handleNotification to this instance
    this.handleNotification = this.handleNotification.bind(this);
    this.notifyChar.addEventListener('characteristicvaluechanged', this.handleNotification);
  }

  createCommand(cmdId, payload) {
    const len = payload.length;
    const header = [0x22,0x21,cmdId & 0xFF,0x00,len & 0xFF,(len>>8)&0xFF];
    const cmd = new Uint8Array(header.concat(Array.from(payload)));
    const crc = calculateCRC8(payload);

    logger.debug(`[MXW01] Creating command 0x${cmdId.toString(16).toUpperCase()}`, {
      payloadLength: len,
      crc: '0x' + crc.toString(16).padStart(2, '0')
    });

    return new Uint8Array([...cmd, crc, 0xFF]);
  }

  handleNotification(event) {
    const data = new Uint8Array(event.target.value.buffer);

    // Check for Magic Bytes: 0x22 0x21
    if (data[0] !== 0x22 || data[1] !== 0x21) {
      logger.debug(`[MXW01] Ignoring notification with unexpected header: ${data[0].toString(16)} ${data[1].toString(16)}`);
      return;
    }

    const cmdId = data[2];
    const len = data[4] | (data[5] << 8);
    const payload = data.slice(6, 6 + len);

    logger.debug(`[MXW01] Received notification for command 0x${cmdId.toString(16).toUpperCase()}`, {
      payloadLength: len
    });

    const resolver = this.pendingResolvers.get(cmdId);
    if (resolver) {
      resolver(payload);
      this.pendingResolvers.delete(cmdId);
    } else {
      logger.warn(`[MXW01] No pending resolver for command 0x${cmdId.toString(16).toUpperCase()}`);
    }
  }

  waitForNotification(cmdId, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResolvers.delete(cmdId);
        const error = `Timeout waiting for notification 0x${cmdId.toString(16)}`;
        logger.error(error);
        reject(new Error(error));
      }, timeoutMs);

      this.pendingResolvers.set(cmdId, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  async getBatteryLevel() {
    try {
      try {
        await this.controlChar.writeValue(this.createCommand(CommandIDs.GET_BATTERY, Uint8Array.of(0x00)));
        const batteryPayload = await this.waitForNotification(CommandIDs.GET_BATTERY, 5000);
        if (batteryPayload && batteryPayload.length > 0) {
          this.lastKnownBatteryLevel = batteryPayload[0];
          return this.lastKnownBatteryLevel;
        }
      } catch (e) {
        logger.warn('Failed to get battery with AB command, falling back to status', { error: e.message });
      }

      const statusResult = await this.getPrinterStatus();
      if (statusResult && statusResult.batteryLevel !== undefined) {
        this.lastKnownBatteryLevel = statusResult.batteryLevel;
        return this.lastKnownBatteryLevel;
      }

      if (this.lastKnownBatteryLevel !== null) {
        return this.lastKnownBatteryLevel;
      }

      throw new Error('Failed to retrieve battery level');
    } catch (error) {
      throw error;
    }
  }

  async getPrinterStatus() {
    if (!this.controlChar) throw new Error('Not connected');

    try {
      await this.controlChar.writeValue(this.createCommand(CommandIDs.GET_STATUS, Uint8Array.of(0x00)));
      const statusPayload = await this.waitForNotification(CommandIDs.GET_STATUS, 5000);

      if (!statusPayload) return null;

      const result = {
        raw: statusPayload,
        isError: false,
        errorCode: null,
        batteryLevel: null,
        temperature: null,
        statusCode: null
      };

      if (statusPayload.length >= 7) result.statusCode = statusPayload[6];
      if (statusPayload.length >= 10) result.batteryLevel = statusPayload[9];
      if (statusPayload.length >= 11) result.temperature = statusPayload[10];

      if (statusPayload.length >= 13 && statusPayload[12] !== 0) {
        result.isError = true;
        if (statusPayload.length >= 14) result.errorCode = statusPayload[13];
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  async printImage(canvas, options = {}) {
    const intensity = options.intensity !== undefined ? options.intensity : 0x5D;
    logger.info('Starting print job (MXW01)', { intensity });
    const startTime = Date.now();
    
    // Shared image processing
    logger.info('Converting image to 1-bit format');
    const rowsBool = processImageTo1bpp(canvas);
    const height = rowsBool.length;
    
    logger.info('Rotating image 180° for printing');
    const rotatedRows = rowsBool.reverse().map(row => row.slice().reverse());

    const buffer = prepareImageDataBuffer(rotatedRows);

    try {
      // 1) Set intensity
      await this.controlChar.writeValue(this.createCommand(0xA2, Uint8Array.of(intensity)));

      // 2) Request status
      await this.getPrinterStatus();

      // 3) Send print request
      const reqData = new Uint8Array(4);
      reqData[0] = height & 0xFF;
      reqData[1] = (height>>8)&0xFF;
      reqData[2] = 0x30;
      reqData[3] = 0;

      await this.controlChar.writeValue(this.createCommand(0xA9, reqData));
      const printAck = await this.waitForNotification(CommandIDs.PRINT, 5000);

      if (!printAck || printAck[0] !== 0) {
        throw new Error('Print request rejected');
      }

      // 4) Transfer image data in chunks
      const chunkSize = PRINTER_WIDTH_BYTES;
      let pos = 0;
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      while (pos < buffer.length) {
        const chunk = buffer.subarray(pos, pos + chunkSize);
        await this.dataChar.writeValueWithoutResponse(chunk);
        pos += chunk.length;
        logger.setProgress(50 + Math.round((pos / buffer.length) * 40));
        await sleep(15);
      }

      // 5) Flush
      await this.controlChar.writeValue(this.createCommand(0xAD, Uint8Array.of(0x00)));

      // 6) Wait for completion
      const complete = await this.waitForNotification(CommandIDs.PRINT_COMPLETE, 20000);

      if (!complete) {
        logger.warn('No print-complete notification received');
      } else {
        const printTime = (Date.now() - startTime) / 1000;
        logger.success('Print completed', { executionTime: printTime.toFixed(1) + 's' });
      }

      logger.setProgress(100);
    } catch (error) {
      logger.error('Printing failed', { message: error.message });
      throw error;
    }
  }
}

class StandardDriver {
  constructor(device, server, controlChar, notifyChar) {
    this.device = device;
    this.server = server;
    this.controlChar = controlChar;
    this.notifyChar = notifyChar;
    this.lastKnownBatteryLevel = null;
    this.isPrinting = false;
  }

  createCommand(cmdId, payload) {
    const len = payload.length;
    const header = [0x51, 0x78, cmdId & 0xFF, 0x00, len & 0xFF, 0x00];
    const cmd = new Uint8Array(header.concat(Array.from(payload)));
    const crc = calculateCRC8(payload);
    
    return new Uint8Array([...cmd, crc, 0xFF]);
  }

  async sendCommand(cmdId, payload) {
    const cmd = this.createCommand(cmdId, payload);
    await this.controlChar.writeValue(cmd);
  }

  async getBatteryLevel() {
    return 100;
  }

  async getPrinterStatus() {
    return { isError: false };
  }

  async printImage(canvas, options = {}) {
    logger.info('Starting print job (Standard)', options);
    const startTime = Date.now();

    // Shared image processing
    logger.info('Converting image to 1-bit format');
    const rowsBool = processImageTo1bpp(canvas);
    const height = rowsBool.length;

    // Geometric Rotation: For Standard, we simply reverse the array of rows (Bottom-up?)
    // AND Horizontal Flip (reverse row content) because the user reported mirroring.
    const rotatedRows = rowsBool.reverse().map(row => row.slice().reverse());
    
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // 1. Start Printing (0xA3)
      logger.debug('[Standard] Sending Start Printing');
      await this.sendCommand(0xA3, Uint8Array.of(0x00));
      await sleep(50);

      // 2. Configure Print Density/Speed

      // 2a. Set DPI (0xA4) -> 200dpi (Payload 50 / 0x32) based on NaitLee protocol
      await this.sendCommand(0xA4, Uint8Array.of(0x32));
      await sleep(50);

      // 2b. Set Speed (0xBD)
      // NaitLee formula: speed = 4 * (Quality + 5). Default Quality 3 -> Speed 32.
      // Higher value = Slower speed = Darker print.
      // We'll set a default of 33 (slightly slower/darker than default).
      // We could optionally map options.intensity to speed too, but let's stick to Energy first.
      const speedVal = 33;
      logger.debug(`[Standard] Setting Speed to ${speedVal} (0x${speedVal.toString(16)})`);
      await this.sendCommand(0xBD, Uint8Array.of(speedVal));
      await sleep(50);

      // 2c. Set Energy (0xAF) & Apply (0xBE)
      // Map 0-255 intensity to 0-65535 energy.
      // Default NaitLee medium is 0x4000 (16384).
      // Intensity 100 -> 25600. Intensity 200 -> 51200.
      const energyVal = (options.intensity || 200) * 256;
      const energyBytes = new Uint8Array([energyVal & 0xFF, (energyVal >> 8) & 0xFF]); // Little Endian

      logger.debug(`[Standard] Setting Energy to 0x${energyVal.toString(16)}`);
      await this.sendCommand(0xAF, energyBytes);
      await this.sendCommand(0xBE, Uint8Array.of(0x01)); // Apply
      await sleep(50);

      // 3. Start Lattice (0xA6)
      logger.debug('[Standard] Sending Start Lattice');
      const latticeStart = new Uint8Array([0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c]);
      await this.sendCommand(0xA6, latticeStart);
      await sleep(50);

      // 4. Send Image Data (0xA2)
      logger.info(`Printing ${height} rows...`);
      for (let y = 0; y < height; y++) {
        let rowBytes = encode1bppRow(rotatedRows[y]);

        // No bit reversal needed (LSB source -> LSB printer)

        await this.sendCommand(0xA2, rowBytes);

        if (y % 5 === 0) await sleep(5);
        if (y % 20 === 0) logger.setProgress(Math.round((y / height) * 100));
      }

      // 5. End Lattice (0xA6)
      logger.debug('[Standard] Sending End Lattice');
      const latticeEnd = new Uint8Array([0xaa, 0x55, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17]);
      await this.sendCommand(0xA6, latticeEnd);

      // 6. Feed Paper (0xA1) -> Payload: 0x80 0x00 (128 pixels)
      logger.debug('[Standard] Feeding Paper');
      await this.sendCommand(0xA1, new Uint8Array([0x80, 0x00]));

      const printTime = (Date.now() - startTime) / 1000;
      logger.success('Print completed (Standard)', { executionTime: printTime.toFixed(1) + 's' });
      logger.setProgress(100);

    } catch (e) {
      logger.error('Standard printing failed', e);
      throw e;
    }
  }
}

// Global active driver
let activeDriver = null;
let activeDevice = null;

// Helper to determine driver type via handshake
async function detectDriver(device, server, controlChar, notifyChar) {
  logger.info(`Detecting driver for "${device.name}"...`);

  // 1. Name-based fast path
  const name = (device.name || '').trim();
  const knownStandard = STANDARD_MODELS.some(m => name.includes(m));

  if (knownStandard) {
    logger.success(`Device name matches known Standard model. Using Standard Driver.`);
    return new StandardDriver(device, server, controlChar, notifyChar);
  }

  // 2. Fallback: Active Probe
  logger.info('Device name unknown or ambiguous. Starting active protocol probe...');

  return new Promise(async (resolve, reject) => {
    let settled = false;

    const handler = (event) => {
        const data = new Uint8Array(event.target.value.buffer);
        if (settled) return;

        // Check magic bytes
        if (data[0] === 0x22 && data[1] === 0x21) {
            logger.success('Received MXW01 response. Using MXW01 Driver.');
            settled = true;
            notifyChar.removeEventListener('characteristicvaluechanged', handler);
            server.getPrimaryService(MAIN_SERVICE_UUID)
                .catch(() => server.getPrimaryService(MAIN_SERVICE_UUID_ALT))
                .then(svc => svc.getCharacteristic(DATA_WRITE_UUID))
                .then(dataChar => {
                    resolve(new MXW01Driver(device, server, controlChar, dataChar, notifyChar));
                })
                .catch(err => {
                    logger.error('MXW01 protocol detected but Data Characteristic missing!', err);
                    reject(err);
                });
        }
        else if (data[0] === 0x51 && data[1] === 0x78) {
            logger.success('Received Standard response. Using Standard Driver.');
            settled = true;
            notifyChar.removeEventListener('characteristicvaluechanged', handler);
            resolve(new StandardDriver(device, server, controlChar, notifyChar));
        }
    };

    notifyChar.addEventListener('characteristicvaluechanged', handler);

    try {
        // MXW01 Ping (Get Status)
        const mxw01PingReal = new Uint8Array([0x22, 0x21, 0xA1, 0x00, 0x00, 0x00, 0x00, 0xFF]);
        // Standard Ping (Get Status/State)
        const stdPing = new Uint8Array([0x51, 0x78, 0xA1, 0x00, 0x00, 0x00, 0x00, 0xFF]);

        logger.debug('Sending MXW01 Ping...');
        await controlChar.writeValue(mxw01PingReal);

        logger.debug('Sending Standard Ping...');
        await controlChar.writeValue(stdPing);

        setTimeout(() => {
            if (!settled) {
                logger.warn('Probe timed out. Defaulting to MXW01 Driver (Legacy behavior).');
                settled = true;
                notifyChar.removeEventListener('characteristicvaluechanged', handler);

                server.getPrimaryService(MAIN_SERVICE_UUID)
                    .catch(() => server.getPrimaryService(MAIN_SERVICE_UUID_ALT))
                    .then(svc => svc.getCharacteristic(DATA_WRITE_UUID))
                    .then(dataChar => {
                        resolve(new MXW01Driver(device, server, controlChar, dataChar, notifyChar));
                    })
                    .catch(err => {
                         logger.warn('Fallback: Data Char missing, using Standard Driver.');
                         resolve(new StandardDriver(device, server, controlChar, notifyChar));
                    });
            }
        }, 2000);

    } catch (e) {
        logger.error('Error during probe', e);
        reject(e);
    }
  });
}

export async function connectPrinter() {
  logger.info('Connecting to printer...');
  
  if (typeof navigator.bluetooth === 'undefined') {
    throw new Error('Web Bluetooth API unavailable.');
  }
  
  if (activeDevice && activeDevice.gatt.connected) {
    logger.info('Already connected to printer');
    return;
  }
  
  try {
    let device;
    try {
        device = await navigator.bluetooth.requestDevice({
            filters: [
                { services: [MAIN_SERVICE_UUID] },
                { services: [MAIN_SERVICE_UUID_ALT] }
            ],
            optionalServices: [MAIN_SERVICE_UUID, MAIN_SERVICE_UUID_ALT, CONTROL_WRITE_UUID, DATA_WRITE_UUID, NOTIFY_UUID]
        });
    } catch (err) {
        logger.warn('Filter discovery failed, falling back to accept all devices');
        device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [MAIN_SERVICE_UUID, MAIN_SERVICE_UUID_ALT, CONTROL_WRITE_UUID, DATA_WRITE_UUID, NOTIFY_UUID]
        });
    }

    logger.info(`Printer found: "${device.name}"`);
    const server = await device.gatt.connect();
    activeDevice = device;
    
    // Dump Services for Debugging (User Request)
    try {
        const services = await server.getPrimaryServices();
        logger.info('Discovered Services:', services.map(s => s.uuid));
    } catch (e) { logger.warn('Service discovery debug dump failed', e); }

    let svc;
    try {
      svc = await server.getPrimaryService(MAIN_SERVICE_UUID);
    } catch (e) {
      svc = await server.getPrimaryService(MAIN_SERVICE_UUID_ALT);
    }
    
    const controlChar = await svc.getCharacteristic(CONTROL_WRITE_UUID);
    const notifyChar = await svc.getCharacteristic(NOTIFY_UUID);
    await notifyChar.startNotifications();
    
    // Use Robust Detection
    activeDriver = await detectDriver(device, server, controlChar, notifyChar);
    
    logger.success('Printer driver initialized.');
  } catch (err) {
    logger.error('Connection failed', err);
    throw err;
  }
}

export async function getBatteryLevel() {
  if (activeDriver) return activeDriver.getBatteryLevel();
  throw new Error('Not connected');
}

export async function getPrinterStatus() {
  if (activeDriver) return activeDriver.getPrinterStatus();
  throw new Error('Not connected');
}

export function isPrinterConnected() {
  return !!(activeDriver && activeDriver.device && activeDriver.device.gatt.connected);
}

export function getLastKnownBatteryLevel() {
  return activeDriver ? activeDriver.lastKnownBatteryLevel : null;
}

export async function printImage(canvas, options) {
  if (activeDriver) return activeDriver.printImage(canvas, options);
  throw new Error('Not connected');
}

export async function disconnectPrinter() {
  if (activeDevice && activeDevice.gatt.connected) {
    logger.info('Disconnecting printer...');
    activeDevice.gatt.disconnect();
    activeDevice = null;
    activeDriver = null;
    logger.success('Printer disconnected.');
  }
}
