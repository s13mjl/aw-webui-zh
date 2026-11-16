import { i18n } from '~/i18n';

/**
 * Cross-platform file download utility.
 *
 * In a regular browser, uses the standard <a download> pattern.
 * In a Tauri webview, uses the dialog + fs plugins to show a native
 * save dialog and write the file directly (webviews don't support
 * the <a download> pattern).
 *
 * See: https://github.com/ActivityWatch/aw-tauri/issues/199
 */

import Papa from 'papaparse';

import { IEvent } from './interfaces';

/**
 * 电子表格会当作公式执行的单元格：以 `=` `+` `-` `@` 开头，前导空白后同样算数
 * （Excel 和 LibreOffice 会裁掉前导空白，所以 " =1+1" 也会执行）。窗口标题来自
 * 网页和其他应用，因此导出的标题在 CSV 被打开时绝不能运行。
 * 与 aw-server-rust 及 aw-server 的 `/export/csv` 端点保持一致。
 *
 * 同步上游 https://github.com/ActivityWatch/aw-webui/pull/1192
 */
export const CSV_FORMULA_PATTERN = /^[ \t\r\n]*[=+\-@]/;

/** 给疑似公式的 CSV 单元格加 `'` 前缀，让电子表格以文本显示。 */
export function neutralizeCsvFormula(value: string): string {
  return CSV_FORMULA_PATTERN.test(value) ? `'${value}` : value;
}

/**
 * Report 视图事件的 CSV：一个表头行，随后每个事件一行。
 * PapaParse 对数组行的 `columns` 选项不生效，因此表头须通过 `fields` 传入。
 */
export function reportEventsCsv(events: IEvent[]): string {
  return Papa.unparse(
    {
      fields: ['timestamp', 'duration', 'category', 'app', 'title'],
      data: events.map(e => [
        e.timestamp,
        e.duration,
        // PapaParse 在把数组强制转成逗号分隔文本前先检查字符串。
        String(e.data['$category'] ?? ''),
        e.data['app'],
        e.data['title'],
      ]),
    },
    { escapeFormulae: CSV_FORMULA_PATTERN }
  );
}

interface FileFilter {
  name: string;
  extensions: string[];
}

function isTauri(): boolean {
  return '__TAURI__' in window;
}

/**
 * Download/save a file with the given content.
 *
 * @param filename - Default filename for the download
 * @param content - File content as a string
 * @param mimeType - MIME type (e.g. 'application/json', 'text/csv')
 */
export async function downloadFile(
  filename: string,
  content: string,
  mimeType: string
): Promise<void> {
  if (isTauri()) {
    await downloadFileTauri(filename, content, mimeType);
  } else {
    downloadFileBrowser(filename, content, mimeType);
  }
}

function getFilters(mimeType: string): FileFilter[] {
  if (mimeType.includes('json')) {
    return [{ name: 'JSON', extensions: ['json'] }];
  } else if (mimeType.includes('csv')) {
    return [{ name: 'CSV', extensions: ['csv'] }];
  }
  return [];
}

async function downloadFileTauri(
  filename: string,
  content: string,
  mimeType: string
): Promise<void> {
  try {
    // These modules are only available in the Tauri runtime (injected by aw-tauri).
    // Using new Function() to bypass static analysis by webpack and rollup,
    // which would otherwise fail to resolve these packages at build time.
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
    const { save } = (await dynamicImport('@tauri-apps/plugin-dialog')) as {
      save: (opts: object) => Promise<string | null>;
    };
    const { writeTextFile } = (await dynamicImport('@tauri-apps/plugin-fs')) as {
      writeTextFile: (path: string, contents: string) => Promise<void>;
    };

    const path = await save({
      title: i18n.t('common.saveExport') as string,
      defaultPath: filename,
      filters: getFilters(mimeType),
    });

    if (path) {
      await writeTextFile(path, content);
    }
  } catch (e) {
    console.warn('Tauri save failed, falling back to browser download:', e);
    // Fall back to browser method if Tauri plugins aren't available
    downloadFileBrowser(filename, content, mimeType);
  }
}

function downloadFileBrowser(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
