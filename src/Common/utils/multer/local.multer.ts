import { StorageApproachEnum } from "./../../enum/multer.enum";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { fileTypeFromBuffer } from "file-type";
import { BadRequestException } from "../../exception";
import { Request } from "express";
import { tmpdir } from "node:os";

export const fileValidation = {
  image: ["image/jpeg", "image/png", "image/gif"],
  filles: ["application/pdf"],
};
export const localFileUpload = ({
  maxFileSize = 5,
  storageApproach = StorageApproachEnum.MEMORY,
}: {
  maxFileSize?: number;
  storageApproach: StorageApproachEnum;
}) => {
  const storage =
    storageApproach === StorageApproachEnum.MEMORY
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination(req, file, callback) {
            callback(null, tmpdir());
          },
          // never reuse the client's file name, it may contain path tricks
          filename(req, file, callback) {
            callback(null, randomUUID());
          },
        });

  return multer({
    storage,
    limits: { fileSize: maxFileSize * 1024 * 1024 },
  });
};

export const processFile = async ({
  customPath = "general",
  file,
  validation,
}: {
  customPath?: string;
  file: Express.Multer.File;
  validation: string[];
}) => {
  if (file.path) {
    file.buffer = await readFile(file.path);
  }

  const result = await fileTypeFromBuffer(file.buffer);

  if (!result || !validation.includes(result.mime)) {
    if (file.path) await unlink(file.path).catch(() => undefined);
    throw new BadRequestException("invalid file format");
  }
  await mkdir(resolve(`./assets/${customPath}`), { recursive: true });
  const uniqueFilePath = `assets/${customPath}/${randomUUID()}.${result.ext}`;

  await writeFile(resolve(`./${uniqueFilePath}`), file.buffer);
  if (file.path) {
    await unlink(file.path).catch(() => undefined);
  }
  file.path = uniqueFilePath;

  return file;
};
export const processFiles = async ({
  customPath = "general",
  files,
  validation,
}: {
  customPath?: string;
  files: Express.Multer.File[];
  validation: string[];
}) => {
  const assets = [];

  for (const file of files) {
    const uploadFile = await processFile({ customPath, file, validation });
    assets.push(uploadFile);
  }
  return assets;
};
export const processMulterUpload = async ({
  req,
  customPath = "general",
  validation = [],
  isRequired = true,
}: {
  customPath?: string;
  validation: string[];
  req: Request;
  isRequired?: boolean;
}) => {
  if (req.file) {
    await processFile({ customPath, file: req.file, validation });
  } else if (Array.isArray(req.files) && req.files.length) {
    await processFiles({ customPath, files: req.files, validation });
  } else if (isRequired) {
    throw new BadRequestException("missing file");
  }
};
