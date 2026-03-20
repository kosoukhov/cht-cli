import { writeFile } from "atomically";

/**
 * Write content to a file atomically using temp-file + fsync + rename.
 * Prevents data corruption on crash -- never leaves a partial write on disk.
 */
export async function writeFileAtomic(
  filePath: string,
  content: string,
): Promise<void> {
  await writeFile(filePath, content, {
    encoding: "utf-8",
    fsync: true,
    fsyncWait: true,
  });
}
