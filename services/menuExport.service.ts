import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { Product } from '../types/api.types';
import { productsService } from './products.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// getProducts fetches the whole list and pages it locally, so one oversized
// "page" is simply everything.
const EVERYTHING = { page: 1, limit: Number.MAX_SAFE_INTEGER };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const yesNo = (value: boolean | undefined) => (value === false ? 'No' : 'Yes');

/** Turns an array of rows into a sheet with sized columns and 0.00 prices. */
function sheetOf(header: string[], rows: (string | number)[][], widths: number[], priceCol: number) {
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet['!cols'] = widths.map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  for (let r = 1; r <= rows.length; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: priceCol })];
    if (cell) cell.z = '0.00';
  }
  return sheet;
}

/** One row per size, so every price on the menu gets its own line. */
function menuSheet(items: Product[]) {
  const sorted = [...items].sort((a, b) =>
    (a.category?.name ?? '').localeCompare(b.category?.name ?? '') || byName(a, b));

  const rows = sorted.flatMap(item => {
    const base = [item.category?.name ?? '', item.name, item.description ?? ''];
    const sizes = item.sizes?.length ? item.sizes : [{ name: '', price: 0, isAvailable: true }];
    return sizes.map(size => [
      ...base, size.name, size.price, yesNo(size.isAvailable), yesNo(item.isAvailable),
    ]);
  });

  return sheetOf(
    ['Category', 'Item', 'Description', 'Size', 'Price', 'Size available', 'Item available'],
    rows,
    [18, 28, 40, 12, 10, 14, 14],
    4,
  );
}

function toppingsSheet(toppings: Product[]) {
  const rows = [...toppings].sort(byName).map(topping => [
    topping.name, topping.sizes?.[0]?.price ?? 0, yesNo(topping.isAvailable),
  ]);
  return sheetOf(['Topping', 'Price', 'Available'], rows, [28, 10, 12], 1);
}

function fileNameFor(label?: string) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = (label ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `menu${slug ? `-${slug}` : ''}-${date}.xlsx`;
}

export const menuExportService = {
  /**
   * Builds an .xlsx of the whole menu (every category, available or not) plus
   * toppings, then hands it to the share sheet — or downloads it on web.
   * `label` (e.g. the branch name) goes into the file name.
   */
  exportMenu: async (label?: string) => {
    const [items, toppings] = await Promise.all([
      productsService.getProducts({ ...EVERYTHING, type: 'main' }),
      productsService.getProducts({ ...EVERYTHING, type: 'topping' }),
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, menuSheet(items.items), 'Menu');
    XLSX.utils.book_append_sheet(workbook, toppingsSheet(toppings.items), 'Toppings');

    const fileName = fileNameFor(label);

    if (Platform.OS === 'web') {
      XLSX.writeFile(workbook, fileName);
      return;
    }

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing isn’t available on this device.');
    }

    const bytes: ArrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const file = new File(Paths.cache, fileName);
    file.create({ overwrite: true });
    file.write(new Uint8Array(bytes));

    await Sharing.shareAsync(file.uri, {
      mimeType: XLSX_MIME,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
      dialogTitle: 'Export menu',
    });
  },
};
