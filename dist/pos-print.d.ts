/// <reference types="node" />
export function getPrinters(): any[];
export function printText(printerName:string, text:string):Promise<any>;
export function printRaw(printerName:string, data:any):Promise<any>;
export function printImageByTSC(options: {
    printer: string;
    url: string;
    pageWidth: number;
    pageHeight: number;
    gap: number;
    copy: number;
}): Promise<any>;
export function printImageByESC(options: {
    printer: string;
    url: string;
    maxWidth: number;
}): Promise<any>;