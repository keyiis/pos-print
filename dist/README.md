# pos-print
esc tsc print for nodejs<br>
This module dependencies [node-printer](https://github.com/tojocky/node-printer)<br>

#How to use
* javascript
`const print = require('pos-print');`
* typescript
`import * as print from 'pos-print'`

# API
* getPrinters()<br>
Get all installed printers<br>
* printText(printerName:string, text:string)<br>
Return Promise<br>
Print text,`print.printText('epson-58','hello!')`<br>
* printRaw(printerName:string, data:any)<br>
Return Promise<br>
Print cmd,`print.printRaw('epson-58','\x1b\x40')`<br>
* printImageByTSC(options)<br>
options{
    printer: string;
    url: string;
    pageWidth: number;
    pageHeight: number;
    gap: number;
    copy: number;
}<br>
Return Promise<br>
Print image by TSC<br>

* printImageByESC(options)<br>
options{
    printer: string;
    url: string;
    maxWidth: number;
}<br>
Return Promise<br>
Print image by ESC/POS

