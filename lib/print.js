const printer = require('printer'), iconv = require('iconv-lite'), getPixels = require("get-pixels"), _ = require('lodash');
// 打印机指令类型
const PrintCmdType = {
    ESC: 'ESC/POS',//用于票据打印
    TSC: 'TSC'//用于标签打印
}
/**
 *获取系统可用打印机
 *
 * @returns
 */
exports.getPrinters= function() {
    return printer.getPrinters();
}
/**
 *打印文本
 *
 * @export
 * @returns
 */
exports.printText= function(printerName, text) {
    return new Promise((resolve, reject) => {
        printer.printDirect({
            data: iconv.encode(text, 'gbk'),/*GB18030兼容性更好,考虑替代*/
            type: 'TEXT',
            printer: printerName,
            success: resolve,
            error: reject
        });
    });
}
/**
 *使用命令打印
 *
 * @export
 * @param {*} printerName 打印机名称
 * @param {*} data 需要打印的数据
 * @returns
 */
exports.printRaw= function(printerName, data) {
    return new Promise((resolve, reject) => {
        try {
            printer.printDirect({
                data: data,
                type: "RAW",
                printer: printerName,
                success: resolve,
                error: err => {
                    // console.log(1,err);
                    reject(err);
                }
            });
        } catch (error) {
            // console.log(2,error);
            reject(error);
        }
    });
}
/**
 *打印图片
 *
 * @export
 * @param {*} printerName 打印机
 * @param {*} cmdType 命令类型,例如TSC ESC/POS
 * @param {*} dataurl 黑白图片的dataurl
 * @param {*} options 针对不同命令类型的设置参数
 */
exports.printImage= async function(printerName, cmdType, dataurl, options) {
    // TSC指令
    if (cmdType == PrintCmdType.TSC) {
        await printImageByTSC({
            printer: printerName,
            url: dataurl,
            pageWidth: options.config.width,
            pageHeight: options.config.height,
            gap: options.config.gap,
            copy: options.copy
        });
    }
    // ESCPOS指令
    if (cmdType == PrintCmdType.ESC) {
        await printImageByESC({
            printer: printerName,
            url: dataurl,
            maxWidth: options.config.width
        });
    }

}
/**
 * 使用ESC/POS指令打印图片
 * @param  {string} printer
 * @param  {string} url
 * @param  {number} maxWidth
 */
async function printImageByESC(options) {
    options = merge({ copy: 1 }, options);
    let buffer = await img2Buffer(options.url, PrintCmdType.ESC, options.maxWidth);
    let cmdBuffers = [];
    // 打印前清空数据
    // cmdBuffers.push(iconv.encode('\x00\x00', 'gbk'));
    //初始化打印机
    cmdBuffers.push(iconv.encode('\x1b\x40', 'gbk'));
    // 打印光栅位图指令的十进制表示
    let printCmd = [29, 118, 48, 0, buffer.byteLength & 255, buffer.byteLength >> 8, buffer.height & 255, buffer.height >> 8];
    printCmd.forEach(cmd => {
        let buf = new Buffer(1);
        buf.writeUInt8(cmd, 0);
        cmdBuffers.push(buf);
    });
    cmdBuffers.push(buffer.imgData);
    let cmdBuffer = Buffer.concat(cmdBuffers);
    await printRaw(options.printer, cmdBuffer);
}
/**
 *使用TSC指令打印
 *
 * @param {*} options
 */
async function printImageByTSC(options) {
    options = merge({ gap: 2, copy: 1 }, options);
    let bufobj = await img2Buffer(options.url, PrintCmdType.TSC, options.pageWidth, options.pageHeight);
    // 将bitmap打印命令转为二进制buffer
    let imgCmdBuffers = [];
    imgCmdBuffers.push(iconv.encode(`SIZE ${options.pageWidth} mm,${options.pageHeight} mm\r\n`, 'gbk'));
    imgCmdBuffers.push(iconv.encode(`GAP ${options.gap || 2} mm,0 mm\r\n`, 'gbk'));
    imgCmdBuffers.push(iconv.encode(`CLS\r\n`, 'gbk'));
    imgCmdBuffers.push(iconv.encode(`BITMAP 0,0,${bufobj.byteLength},${bufobj.height},0,`, 'gbk'));
    imgCmdBuffers.push(bufobj.imgData);
    imgCmdBuffers.push(iconv.encode(`\r\nPRINT 1,${Math.round(options.copy)}\r\n`, 'gbk'));
    let imgCmdBuffer = Buffer.concat(imgCmdBuffers);
    await printRaw(options.printer, imgCmdBuffer);
}

/**
 * 根据图片的url转换成bitmap
 * ECS 0不打印 1打印   高低位 76543210
 * TSC 0打印 1不打印   高低位 76543210
 * @param {*} url
 * @param {*} cmdType
 * @param {number} _maxWidth
 * @param {number} _maxHeight
 * @returns
 */
async function img2Buffer(url, cmdType, _maxWidth, _maxHeight) {
    let maxWidth = mm2Px(_maxWidth);
    let maxHeight = _maxHeight ? mm2Px(_maxHeight) : 65635;
    if (!_.isString(url) && _.isEmpty(url)) {
        throw new Error('传入的图片链接无效！');
    }
    // 获得像素值
    let pixels = await getPixelsByUrl(url);
    let width = pixels.shape[0];
    let height = pixels.shape[1];
    if (width > maxWidth || height > maxHeight) {
        throw new Error(`图片宽度${width}px不能超过${maxWidth}px,高度${height}px不能超过${maxHeight}px.`);
    }
    // 将图像转换为单色二进制的buffer
    let imgCmdBuffers = [];
    //8个字节一组
    let byteLength = Math.ceil(width / 8);
    for (var y = 0; y < height; y++) {// 遍历Y轴
        // 开始遍历X轴
        for (var x = 0; x < byteLength; x++) {// 遍历每一组,
            //默认为0,ESC代表不打印,TSC代表打印
            let dots = 0;//0是二进制 00000000 代表X轴的8个像素点
            for (var n = 0; n < 8; n++) {
                dots += calDotValue(cmdType, pixels, y, x, n);
            }
            let buf = new Buffer(1);
            buf.writeUInt8(dots, 0);
            imgCmdBuffers.push(buf);
        }
    }
    return {
        'imgData': Buffer.concat(imgCmdBuffers),
        'byteLength': byteLength,
        'width': width,
        'height': height
    };
}
/**
 * 毫米转像素(打印时1px代表一个dot)
 * 佳博的标签和票据打印机一般都是200dpi:1mm=8dot
 * @param  {number} mm
 */
function mm2Px(mm) {
    return Math.round(mm * 8);
}

/**
 * 根据图片的dataurl获得像素值
 *
 * @param {*} url
 * @returns
 */
function getPixelsByUrl(url) {
    return new Promise((resolve, reject) => {
        getPixels(url, (err, pixels) => {
            if (err) return reject(err);
            resolve(pixels);
        })
    });
}
/**
 * 根据像素点的颜色获得亮度并返回当前点是否打印的二进制值
 * 例如:n=2 ESC模式下打印改点即为10 TSC模式下不打印改点即为10
 * n=3 ESC模式下打印改点即为100 TSC模式下不打印改点即为100
 * @param  {string} cmdType 打印命令的类型
 * @param  {any} pixels 图片的像素值
 * @param  {number} y 当前点在Y轴的位置
 * @param  {number} x 当前点在X轴的位置
 * @param  {number} n 当前点在byte中的位置
 */
function calDotValue(cmdType, pixels, y, x, n) {
    let r = pixels.get(x * 8 + n, y, 0);
    let g = pixels.get(x * 8 + n, y, 1);
    let b = pixels.get(x * 8 + n, y, 2);
    // 获得当前点的亮度
    r /= 255;
    g /= 255;
    b /= 255;
    let max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    let brightness = (max + min) / 2;
    // ESC模式下 1代表打印 0代表不打印
    if (cmdType == PrintCmdType.ESC) {
        if (brightness < 0.6) {
            return (1 << (7 - n));
        } else {
            return 0;//代表00000000
        }
    }
    // TSC模式下 0代表打印 1代表不打印
    if (cmdType == PrintCmdType.TSC) {
        if (brightness >= 0.6) {
            return (1 << (7 - n));
        } else {
            return 0;//代表00000000
        }
    }
}