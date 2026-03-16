import fs from 'fs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export function diffImage(oldPath, newPath, diffPath) {
  const img1 = PNG.sync.read(fs.readFileSync(oldPath));
  const img2 = PNG.sync.read(fs.readFileSync(newPath));

  const { width, height } = img1;

  const diff = new PNG({ width, height });

  pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });

  fs.writeFileSync(diffPath, PNG.sync.write(diff));
}
