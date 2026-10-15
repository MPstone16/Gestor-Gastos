import * as FileSystem from 'expo-file-system/legacy';

const RECEIPTS_DIRECTORY = `${FileSystem.documentDirectory}receipts/`;

export async function saveReceipt(uri: string): Promise<string> {
  if (!FileSystem.documentDirectory) {
    throw new Error('El almacenamiento local de la aplicación no está disponible.');
  }

  await FileSystem.makeDirectoryAsync(RECEIPTS_DIRECTORY, { intermediates: true });

  const extension = uri.split('.').pop()?.split(/[?#]/)[0]?.match(/^[a-zA-Z0-9]+$/)?.[0] ?? 'jpg';
  const destination = `${RECEIPTS_DIRECTORY}receipt-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${extension}`;

  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function deleteStoredReceipt(uri: string): Promise<void> {
  if (!uri.startsWith(RECEIPTS_DIRECTORY)) return;

  await FileSystem.deleteAsync(uri, { idempotent: true });
}
