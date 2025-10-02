const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 记录文件的路径
const recordFilePath = path.join(__dirname, 'imageRecords.json');

// 加载或初始化记录文件
let imageRecords = {};
if (fs.existsSync(recordFilePath)) {
    imageRecords = JSON.parse(fs.readFileSync(recordFilePath, 'utf8'));
}

// 下载图片
async function downloadImage(url, filepath) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// 上传图片到接口B
async function uploadImage(filepath) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filepath));

    // 假设接口B接受文件上传并返回新地址
    const response = await axios.post('https://example.com/upload', formData, {
        headers: formData.getHeaders()
    });

    return response.data.newImageUrl; // 返回新的图片地址
}

// 处理字符串，批量查找替换图片地址
async function replaceImageUrls(inputString) {
    const regex = /https:\/\/example\.com\/dev\/(MD\d{6})\/excute/g;
    let match;
    const promises = [];

    // 查找所有图片地址并处理
    while ((match = regex.exec(inputString)) !== null) {
        const imageId = match[1];
        const imageUrl = match[0];

        if (imageRecords[imageId]) {
            // 如果记录文件中已有对应新地址，直接替换
            inputString = inputString.replace(imageUrl, imageRecords[imageId]);
        } else {
            const localFilePath = path.join(__dirname, `${imageId}.jpg`);

            // 异步下载和上传
            const promise = downloadImage(imageUrl, localFilePath)
                .then(() => uploadImage(localFilePath))
                .then((newUrl) => {
                    imageRecords[imageId] = newUrl;
                    inputString = inputString.replace(imageUrl, newUrl);
                });

            promises.push(promise);
        }
    }

    // 等待所有下载和上传完成
    await Promise.all(promises);

    // 更新记录文件
    fs.writeFileSync(recordFilePath, JSON.stringify(imageRecords, null, 2));

    return inputString;
}


const secret = "1234567899999999999";


(
  // 示例使用
  async () => {
    const inputStr = `Here is an image: https://example.com/dev/MD123454/excute and another one: https://example.com/dev/MD123455/excute.`;
    const resultStr = await replaceImageUrls(inputStr);
    console.log("Result:", resultStr);
  }
)();