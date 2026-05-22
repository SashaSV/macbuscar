import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './public/uploads';
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function saveUploadedFile(file) {
  // file is a Web API File object from FormData
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Tipo de archivo no permitido: ${file.type}`);
  }
  if (file.size > MAX_SIZE) {
    throw new Error('El archivo supera el límite de 5 MB');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Unique filename
  const ext = file.name.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
  const hash = crypto.randomBytes(8).toString('hex');
  const filename = `${Date.now()}-${hash}.${ext}`;

  const uploadPath = path.join(process.cwd(), UPLOAD_DIR);
  await mkdir(uploadPath, { recursive: true });

  const filePath = path.join(uploadPath, filename);
  await writeFile(filePath, buffer);

  // Return public URL path
  return `/uploads/${filename}`;
}

export async function saveMultipleFiles(formData, field = 'fotos') {
  const files = formData.getAll(field);
  const paths = [];
  for (const file of files) {
    if (file instanceof File) {
      const p = await saveUploadedFile(file);
      paths.push(p);
    }
  }
  return paths;
}
