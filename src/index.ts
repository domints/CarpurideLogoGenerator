import './shoelace-components';
import './styles.scss';

import { LogoPartitionName, Partition, PartitionDefSize, PartitionNameMaxSize } from './tools';

import SlAlert from '@shoelace-style/shoelace/dist/components/alert/alert.js';
import SlButton from '@shoelace-style/shoelace/dist/components/button/button.js';
import SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import SlInput from '@shoelace-style/shoelace/dist/components/input/input.js';
import SlSelect from '@shoelace-style/shoelace/dist/components/select/select.js';

import * as piexif from 'piexif-ts';
import * as ImageIFD from 'piexif-ts/dist'

import * as MD5 from 'crypto-js/md5';

import Plausible, { EventOptions, PlausibleOptions } from "plausible-tracker";
var plausible = Plausible({
  domain: 'carpu.dszymanski.pl',
  apiHost: 'https://plausible.dszymanski.pl'
});
plausible.enableAutoPageviews();

var pttworker = new Worker("pttjpeg.js");
pttworker.onmessage = function (msg) {
  switch (msg.data.reason) {
    case 'image':
      // an image was sent here. url contains the bytes, as well as the other relevant info
      console.log("image message");
      let url = msg.data.url;
      let zeroth: piexif.IExifElement = {};
      zeroth[piexif.TagValues.ImageIFD.Software] = "CarpurideLogoGenerator";
      let exifObj: piexif.IExif = { "0th": zeroth, "Exif": {}, "GPS": {} };
      let exifStr = piexif.dump(exifObj);
      let adj = piexif.insert(exifStr, url);
      downloadURL(adj, "boot_logo.jpg");
      setTimeout(function () {
        return window.URL.revokeObjectURL(url);
      }, 1000);
      break;
    case 'log':
      // logging from the worker is relied back through this message
      console.log(msg.data.log);
      break;
    default:
      break;
  }
}

function randomString(length: number) {
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split('');

  if (!length) {
    length = Math.floor(Math.random() * chars.length);
  }

  var str = '';
  for (var i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}

let sid = localStorage.getItem("_SID");
if (!sid) {
  sid = randomString(32);
  localStorage.setItem("_SID", sid);
}

enum RenderMethod {
  _702Part,
  _603Jpeg
}

interface LogoMeta {
  version: number;
  magic?: string;
  day?: number;
  month?: number;
  year?: number;
  hour?: number;
  minute?: number;
  uuid?: string;
}

interface IResolution {
  w: number;
  h: number;
  unsupported?: boolean;
  method?: RenderMethod;
}

var resolutions: { [device: string]: IResolution } = {
  "w502": { w: 800, h: 480 },
  "w602": { w: 1080, h: 540 },
  "w603": { w: 1560, h: 720, method: RenderMethod._603Jpeg },
  "w619": { w: 1280, h: 480 },
  "w70x": { w: 1024, h: 600 },
  "w702": { w: 1024, h: 600 },
  "w712": { w: 1024, h: 600, unsupported: true },
  "w901": { w: 1024, h: 600 },
  "w903": { w: 1280, h: 480, unsupported: true },
  "w103": { w: 1280, h: 480 },
  "c92": { w: 1600, h: 600, unsupported: true },
  "yt09": { w: 1024, h: 600 },
  "other": { w: 0, h: 0, unsupported: true }
}

var currImage: HTMLImageElement | null = null;
var currFileName: string = '';
var currDevice: string = '';
var currMethod: RenderMethod = RenderMethod._702Part;
var canvas = <HTMLCanvasElement>document.getElementById("bootlogo");
var currimghash = '';
var currMeta: LogoMeta | null = null;

var ctr = document.getElementById("ctr");
var modelSelect = document.getElementById("model-select");
var imageUploader = <SlInput>document.getElementById("file-upload");
var downloadButton = <SlButton>document.getElementById("download-button");
var baseHelpAlert = <SlAlert>document.getElementById("base-help-alert");
var sizeMismatchAlert = <SlAlert>document.getElementById("size-mismatch-alert");
var invalidFileAlert = <SlAlert>document.getElementById("invalid-file-alert");
var binFileInfoAlert = <SlAlert>document.getElementById("bin-file-info");
var unsupportedDeviceAlert = <SlAlert>document.getElementById("unsupported-device-alert");
var unknownMeta = <SlAlert>document.getElementById("unknown-meta");
var knownMeta = <SlAlert>document.getElementById("known-meta");
var noWarrantyDialog = <SlDialog>document.getElementById("no-warranty-dialog");
var noWarrantyDialogClose = <SlButton>document.getElementById("no-warranty-dialog-close");
var noWarrantyDialogOpen = document.getElementById("show-warranty-popup");
var recommendedWidth = document.getElementById("recommended-width");
var recommendedHeight = document.getElementById("recommended-height");
var binWidth = document.getElementById("bin-width");
var binHeight = document.getElementById("bin-height");
var binMagic = document.getElementById("bin-magic");
var okForDevice = document.getElementById("ok-for-device");
var wrongForDevice = document.getElementById("wrong-for-device");
var canvasContainer = document.getElementById("canvas-container");
var actionsContainer = document.getElementById("actions-container");

const addString = (data: number[], value: string) => {
  const encoder = new TextEncoder();
  var magicBytes = encoder.encode(value);
  data.push(value.length);
  let i = 0;
  while (i < value.length) {
    data.push(magicBytes[i]);
    i++;
  }
}

const generate702MetaBitstream = (meta: LogoMeta): Uint8Array => {
  let result: number[] = [];
  result.push(meta.version);
  addString(result, meta.magic);
  result.push(meta.day);
  result.push(meta.month);
  result.push(meta.year >> 8);
  result.push(meta.year & 0xFF);
  result.push(meta.hour);
  result.push(meta.minute);
  addString(result, meta.uuid);
  return new Uint8Array(result);
}

var updateCanvasSize = () => {
  let res = resolutions[currDevice];
  if (!res)
    return;
  let width = res.w;
  let height = res.h;
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height)
}

var checkImageSize = () => {
  if (currImage.width != canvas.width || currImage.height != canvas.height) {
    recommendedWidth.innerHTML = canvas.width.toString();
    recommendedHeight.innerHTML = canvas.height.toString();
    sizeMismatchAlert.show();
  }
  else {
    sizeMismatchAlert.hide();
  }
}

var loadImageToCanvas = (file: File) => {
  plausible.trackEvent("imageUploaded", { props: { fileName: file.name, device: currDevice, sid: sid } });
  updateCanvasSize();
  currFileName = file.name;
  let fileReader = new FileReader();
  fileReader.onload = e => {
    var img = new Image();
    currimghash = MD5(<string>e.target.result).toString();
    img.src = <string>e.target.result;
    img.onload = () => {
      currImage = img;
      plausible.trackEvent("imageLoaded", { props: { fileName: file.name, device: currDevice, width: canvas.width, uploadWidth: img.width, height: canvas.height, uploadHeight: img.height } });
      checkImageSize();
      canvas.getContext("2d").drawImage(img, 0, 0);
      downloadButton.disabled = false;
    };
  };
  fileReader.readAsDataURL(file);
}

const refreshMetaDisplay = () => {
  if (currMeta) {
    if (currMeta.version == 0) {
      unknownMeta.show();
    }
    else {
      knownMeta.show();
    }
  }
  else {
    unknownMeta.hide();
    knownMeta.hide();
  }
};

var readBootImage = (file: File) => {
  let fileReader = new FileReader();
  fileReader.onload = e => {
    let bfr = new Uint8Array(<ArrayBuffer>e.target.result);
    if (readString(bfr, 0, 4) != 'PART') {
      invalidFileAlert.show();
      return;
    }
    let partMapLocation = readUint32(bfr, 8);
    let partMapSize = readUint32(bfr, 12);
    let partitions: Array<Partition> = [];
    var partitionDefIx = partMapLocation;
    while (partitionDefIx < partMapLocation + partMapSize) {
      let name = readString(bfr, partitionDefIx, PartitionNameMaxSize);
      let size = readUint32(bfr, partitionDefIx + PartitionNameMaxSize);
      let offset = readUint32(bfr, partitionDefIx + PartitionNameMaxSize + 4);
      partitions.push({ name: name, size: size, offset: offset });
      partitionDefIx += PartitionDefSize;
    }

    let logoPartition = partitions.find((p) => p.name == LogoPartitionName);
    if (!logoPartition || readString(bfr, logoPartition.offset, 4) != 'OGOL') {
      invalidFileAlert.show();
      return;
    }

    let width = readUint32(bfr, logoPartition.offset + 0x0C);
    let height = readUint32(bfr, logoPartition.offset + 0x10);
    let magic = readUint32(bfr, logoPartition.offset + 0x14);
    let imgOffset = logoPartition.offset + 0x20;
    canvas.width = width;
    canvas.height = height;
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    let data = new ImageData(width, height);
    let dataOffset = 0;
    let pxOffset = 0;
    let metaBytes: number[] = [];
    let currByte: number = 0x00;
    let readingMeta = true;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        let b = bfr[imgOffset++];
        let g = bfr[imgOffset++];
        let r = bfr[imgOffset++];
        let a = bfr[imgOffset++];
        let currBit = pxOffset % 8;
        if (a == 0xFF || a < 0xFD) {
          readingMeta = false;
        }
        if (readingMeta) {
          if (a == 0xFE)
            currByte = currByte | (1 << currBit);

          if (currBit == 7) {
            metaBytes.push(currByte);
            currByte = 0x00;
          }
        }
        data.data[dataOffset++] = r;
        data.data[dataOffset++] = g;
        data.data[dataOffset++] = b;
        data.data[dataOffset++] = 0xFF;
        pxOffset++;
      }
    }
    if (metaBytes.length > 0) {
      currMeta = {
        version: metaBytes[0]
      };
    }
    else {
      currMeta = {
        version: 0
      };
    }
    refreshMetaDisplay();
    ctx.putImageData(data, 0, 0);
    binWidth.innerHTML = canvas.width.toString();
    binHeight.innerHTML = canvas.height.toString();
    binMagic.innerHTML = magic.toString(16).padStart(8, '0');
    okForDevice.style.display = 'none';
    wrongForDevice.style.display = 'none';
    let res = resolutions[currDevice];
    if (res) {
      if (res.w != width || res.h != height) {
        wrongForDevice.style.display = 'inline';
      }
      else {
        okForDevice.style.display = 'inline';
      }
    }

    binFileInfoAlert.show();
  };
  fileReader.readAsArrayBuffer(file);
}

const getBitValue = (val: number, bit: number): boolean => {
  return ((val >> bit) & 0x01) > 0;
}

var generate702BootImage = () => {
  let imgPartSize = (canvas.width * canvas.height * 4) + 0x20;
  let fileSize = imgPartSize + 0x30;
  const date = new Date();
  const meta: LogoMeta = {
    version: 1,
    magic: 'domints',
    uuid: sid,
    day: date.getDate(),
    month: date.getMonth(),
    year: date.getFullYear(),
    hour: date.getHours(),
    minute: date.getMinutes()
  };
  let metaBytes = generate702MetaBitstream(meta);
  debugger;
  let b = metaBytes[0];
  let bfr = new Uint8Array(fileSize);
  writeString(bfr, 0, 'PART');
  writeUint32(bfr, 4, fileSize);
  writeUint32(bfr, 8, 0x10);
  writeUint32(bfr, 12, 0x20);
  writeString(bfr, 0x10, LogoPartitionName);
  writeUint32(bfr, 0x28, imgPartSize);
  writeUint32(bfr, 0x2C, 0x30);
  writeString(bfr, 0x30, 'OGOL');
  writeUint32(bfr, 0x3C, canvas.width);
  writeUint32(bfr, 0x40, canvas.height);
  writeUint32(bfr, 0x44, 0x000E0003);
  let imgindex = 0x50;
  let ctx = canvas.getContext("2d");
  let pxOffset = 0;
  debugger;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      let colorData = ctx.getImageData(x, y, 1, 1,).data;
      bfr[imgindex++] = colorData[2];
      bfr[imgindex++] = colorData[1];
      bfr[imgindex++] = colorData[0];
      const byteNo = pxOffset / 8;
      let aVal = 0xFF;
      if (byteNo < metaBytes.length) {
        aVal = getBitValue(metaBytes[byteNo], pxOffset % 8) ? 0xFE : 0xFD;
      }
      bfr[imgindex++] = aVal;

      pxOffset++;
    }
  }

  let cnt = localStorage.getItem("_CNT");
  let ncnt = 1;
  if (!cnt) {
    localStorage.setItem("_CNT", '1');
  }
  else {
    ncnt = parseInt(cnt);
    ncnt = ncnt + 1;
    localStorage.setItem("_CNT", ncnt.toString());
  }

  plausible.trackEvent("downloadingBootlogo", { props: { width: canvas.width, height: canvas.height, fileName: currFileName, fileHash: currimghash, device: currDevice, sid: sid, dlCount: ncnt } });
  downloadBlob(bfr, 'isp_part.bin', 'application/octet-stream');
};

var generate603JpegImage = () => {
  let cnt = localStorage.getItem("_CNT");
  let ncnt = 1;
  if (!cnt) {
    localStorage.setItem("_CNT", '1');
  }
  else {
    ncnt = parseInt(cnt);
    ncnt = ncnt + 1;
    localStorage.setItem("_CNT", ncnt.toString());
  }

  plausible.trackEvent("downloadingBootlogo", { props: { width: canvas.width, height: canvas.height, fileName: currFileName, fileHash: currimghash, device: currDevice, sid: sid, dlCount: ncnt } });
  //let url = canvas.toDataURL("image/jpeg", 80);
  let ctx = canvas.getContext("2d");
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let m = {
    'quality': 80,              // quality desired
    'imageData': imageData,      // the imageData object
    'width': canvas.width,    // the width of the image
    'height': canvas.height   // the height of the image
  };

  // Post message to worker
  pttworker.postMessage(m);
  //downloadBlob(bfr, 'boot_logo.jpg', 'application/octet-stream');
}

var readString = (bfr: Uint8Array, index: number, length: number): string => {
  let result = '';
  for (let i = 0; i < length; i++) {
    if (bfr[index + i] == 0x00)
      return result;

    result += String.fromCharCode(bfr[index + i]);
  }

  return result;
}

var readUint32 = (bfr: Uint8Array, index: number): number => {
  let value = 0;
  value |= bfr[index];
  value |= (bfr[index + 1] << 8);
  value |= (bfr[index + 2] << 16);
  value |= (bfr[index + 3] << 24);
  return value;
}

var writeString = (bfr: Uint8Array, index: number, s: string) => {
  for (let i = 0; i < s.length; i++) {
    bfr[index + i] = s.charCodeAt(i);
  }
}

var writeUint32 = (bfr: Uint8Array, index: number, value: number) => {
  bfr[index] = value & 0xFF;
  bfr[index + 1] = (value >> 8) & 0xFF;
  bfr[index + 2] = (value >> 16) & 0xFF;
  bfr[index + 3] = (value >> 24) & 0xFF;
}


var downloadBlob = function (data: Uint8Array, fileName: string, mimeType: string) {
  var blob = new Blob([data], {
    type: mimeType
  });
  var url = window.URL.createObjectURL(blob);
  downloadURL(url, fileName);
  setTimeout(function () {
    return window.URL.revokeObjectURL(url);
  }, 1000);
};

var downloadURL = function (data: string, fileName: string) {
  var a = <HTMLAnchorElement>document.createElement('a');
  a.href = data;
  a.download = fileName;
  document.body.appendChild(a);
  a.className = 'd-none';
  a.click();
  a.remove();
};

modelSelect.addEventListener("sl-change", event => {
  let val = <string>(event.target as SlSelect).value;
  currDevice = val;
  updateCanvasSize();
  let res = resolutions[val];
  if (!res)
    return;

  if (res.unsupported) {
    imageUploader.disabled = true;
    binFileInfoAlert.hide();
    sizeMismatchAlert.hide();
    invalidFileAlert.hide();
    baseHelpAlert.hide();
    unsupportedDeviceAlert.show();
    canvasContainer.classList.add("d-none");
    actionsContainer.classList.add("d-none");
  }
  else {
    unsupportedDeviceAlert.hide();
    baseHelpAlert.show();
    canvasContainer.classList.remove("d-none");
    actionsContainer.classList.remove("d-none");
  }
  if (res.method) {
    currMethod = res.method;
  }
  else {
    currMethod = RenderMethod._702Part;
  }

  let width = res.w;
  let height = res.h;
  let ctx = canvas.getContext("2d");
  if (currImage) {
    checkImageSize();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(currImage, 0, 0);
  }
  else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
  }
  imageUploader.disabled = false;
  binFileInfoAlert.hide();
  plausible.trackEvent("modelSelected", { props: { resolution: `${width}x${height}`, device: val, sid: sid } });
});

imageUploader.addEventListener("sl-change", event => {
  var files = (event.target as SlInput).input.files;
  if (files && files[0]) {
    let file = files[0];
    sizeMismatchAlert.hide();
    invalidFileAlert.hide();
    binFileInfoAlert.hide();
    if (file.type.startsWith("image")) {
      loadImageToCanvas(file);
    }
    else {
      readBootImage(file);
    }
  }
});

document.getElementById("szymanskiio-link").addEventListener("click", _ => {
  plausible.trackEvent("linkClicked", { props: { linkTarget: "szymanski.io" } });
})

document.getElementById("coffee-link").addEventListener("click", _ => {
  plausible.trackEvent("linkClicked", { props: { linkTarget: "buymecoffee" } });
})

document.getElementById("coffee-link-unsupported").addEventListener("click", _ => {
  plausible.trackEvent("linkClicked", { props: { linkTarget: "buymecoffee-unsupported", device: currDevice } });
})

document.getElementById("github-link").addEventListener("click", _ => {
  plausible.trackEvent("linkClicked", { props: { linkTarget: "github" } });
})

document.getElementById("linkedIn-link").addEventListener("click", _ => {
  plausible.trackEvent("linkClicked", { props: { linkTarget: "linkedin" } });
})

document.getElementById("github-repo-link").addEventListener("click", _ => {
  plausible.trackEvent("linkClicked", { props: { linkTarget: "github repo" } });
})

downloadButton.addEventListener("click", event => {
  plausible.trackEvent("bootlogoRequested", { props: { width: canvas.width, height: canvas.height, fileName: currFileName, device: currDevice, sid: sid } });
  if (currMethod == RenderMethod._702Part) {
    generate702BootImage();
  }
  else if (currMethod == RenderMethod._603Jpeg) {
    generate603JpegImage();
  }
});

noWarrantyDialogClose.addEventListener('click', _ => {
  noWarrantyDialog.hide();
  localStorage.setItem("_WHD", 'true');
  plausible.trackEvent("warrantyWarningClosed", { props: { sid: sid } });
});

noWarrantyDialogOpen.addEventListener('click', _ => {
  noWarrantyDialog.show();
})

let warrantyHidden = localStorage.getItem("_WHD");
if (!warrantyHidden)
  noWarrantyDialog.show();