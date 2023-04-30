"use strict";
var fs = require('fs'), fd = fs.openSync(process.execPath, 'r'), stat = fs.fstatSync(fd), tailSize = Math.min(stat.size, 16000), tailWindow = Buffer.alloc(tailSize), match = '<nexe' + '~~sentinel>', matchLength = match.length, lastBuffer = Buffer.alloc(matchLength + 32);
var offset = stat.size, footerPosition = -1, footerPositionOffset = 0, footer;
while (true) {
    var bytesRead = fs.readSync(fd, tailWindow, 0, tailSize, offset - tailSize);
    if (bytesRead === 0)
        break;
    var combinedBuffers = Buffer.concat([tailWindow, lastBuffer]);
    footerPosition = combinedBuffers.indexOf(match);
    if (footerPosition > -1) {
        footer = combinedBuffers.slice(footerPosition, footerPosition + 32);
        break;
    }
    if (offset < 0)
        break;
    tailWindow.copy(lastBuffer);
    offset = offset - bytesRead;
}
if (footerPosition == -1) {
    throw 'Invalid Nexe binary';
}
var contentSize = footer.readDoubleLE(16), resourceSize = footer.readDoubleLE(24), contentStart = offset - tailSize + footerPosition - resourceSize - contentSize, resourceStart = contentStart + contentSize;
Object.defineProperty(process, '__nexe', (function () {
    var nexeHeader = null;
    return {
        get: function () {
            return nexeHeader;
        },
        set: function (value) {
            if (nexeHeader) {
                throw new Error('This property is readonly');
            }
            nexeHeader = Object.assign({}, value, {
                blobPath: process.execPath,
                layout: {
                    stat: stat,
                    contentSize: contentSize,
                    contentStart: contentStart,
                    resourceSize: resourceSize,
                    resourceStart: resourceStart
                }
            });
            Object.freeze(nexeHeader);
        },
        enumerable: false,
        configurable: false
    };
})());
var contentBuffer = Buffer.alloc(contentSize), Module = require('module');
fs.readSync(fd, contentBuffer, 0, contentSize, contentStart);
fs.closeSync(fd);
new Module(process.execPath, null)._compile(contentBuffer.slice(1).toString(), process.execPath);
