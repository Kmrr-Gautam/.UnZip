import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger {
  private logFilePath: string;
  private enabled: boolean = true;

  constructor() {
    const appDir = path.join(os.homedir(), '.UnZip');
    const logsDir = path.join(appDir, 'logs');
    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      this.logFilePath = path.join(logsDir, 'unzip.log');
    } catch {
      this.logFilePath = path.join(os.tmpdir(), 'unzip.log');
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public getLogPath(): string {
    return this.logFilePath;
  }

  public log(level: LogLevel, message: string, meta?: any) {
    if (!this.enabled && level !== 'ERROR') return;

    const timestamp = new Date().toISOString();
    let metaStr = '';
    if (meta) {
      try {
        // Sanitize password from any logged metadata
        const safeMeta = JSON.parse(JSON.stringify(meta, (k, v) => (k.toLowerCase().includes('password') ? '***' : v)));
        metaStr = ' ' + JSON.stringify(safeMeta);
      } catch {
        metaStr = ' [Metadata serialization error]';
      }
    }

    const line = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

    // Console output
    if (level === 'ERROR') {
      console.error(line.trim());
    } else if (level === 'WARN') {
      console.warn(line.trim());
    } else {
      console.log(line.trim());
    }

    // Append to file
    try {
      fs.appendFileSync(this.logFilePath, line, 'utf-8');
    } catch {
      // Ignore write errors to prevent application crashes
    }
  }

  public debug(message: string, meta?: any) {
    this.log('DEBUG', message, meta);
  }

  public info(message: string, meta?: any) {
    this.log('INFO', message, meta);
  }

  public warn(message: string, meta?: any) {
    this.log('WARN', message, meta);
  }

  public error(message: string, meta?: any) {
    this.log('ERROR', message, meta);
  }
}

export const logger = new Logger();
