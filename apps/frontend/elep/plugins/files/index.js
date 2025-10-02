const fs = require('fs')
const path = require('path')

function getFiles(dir) {
  let results = []
  // 获取目录下的所有文件和文件夹
  const list = fs.readdirSync(dir)
  list.forEach((file) => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat && stat.isDirectory()) {
      // 如果是文件夹，递归遍历
      results = results.concat(getFiles(filePath))
    } else if (path.extname(file) === '.TXT') {
      results.push(filePath)
    }
  })
  return results
}

async function main(dir, name) {
  let txt = ''
  const files = await getFiles(dir)
  files.forEach((file, index) => {
    txt += file.split('/').pop()
    txt += '\n'
    txt += fs.readFileSync(file, 'utf8')
    txt += '================================================'
    txt += '\n'
  })
  //   console.log(files)

  fs.writeFileSync(path.join(__dirname, `${name}.txt`), txt, 'utf-8')
}

let booksPath = path.join('/Users/lihaomin/Downloads/三毛全集/')
let books = fs.readdirSync(booksPath)
books.forEach((file) => {
  const filePath = path.join(booksPath, file)
  const stat = fs.statSync(filePath)
  if (stat && stat.isDirectory()) {
    console.log(file)
    main(filePath, file)
  }
})
