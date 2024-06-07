import './shoelace-components';
import './styles.scss';

import { LogoPartitionName, Partition, PartitionDefSize, PartitionNameMaxSize } from './tools';

import SlAlert from '@shoelace-style/shoelace/dist/components/alert/alert.js';
import SlButton from '@shoelace-style/shoelace/dist/components/button/button.js';
import SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import SlInput from '@shoelace-style/shoelace/dist/components/input/input.js';
import SlSelect from '@shoelace-style/shoelace/dist/components/select/select.js';

import Plausible, { EventOptions, PlausibleOptions } from "plausible-tracker";
var plausible = Plausible({
  domain: 'carpu.dszymanski.pl',
  apiHost: 'https://plausible.dszymanski.pl'
});
plausible.enableAutoPageviews();

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

interface IResolution {
  w: number;
  h: number;
}

var resolutions: { [device: string]: IResolution } = {
  "w502": { w: 800, h: 480 },
  "w70x": { w: 1024, h: 600 },
  "w901": { w: 1024, h: 600 },
  "w103": { w: 1280, h: 480 }
}

var currImage: HTMLImageElement = null;
var currFileName: string = '';
var currDevice: string = '';
var canvas = <HTMLCanvasElement>document.getElementById("bootlogo");

var modelSelect = document.getElementById("model-select");
var imageUploader = <SlInput>document.getElementById("file-upload");
var downloadButton = <SlButton>document.getElementById("download-button");
var sizeMismatchAlert = <SlAlert>document.getElementById("size-mismatch-alert");
var invalidFileAlert = <SlAlert>document.getElementById("invalid-file-alert");
var binFileInfoAlert = <SlAlert>document.getElementById("bin-file-info");
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
    let pxOffset = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        let b = bfr[imgOffset++];
        let g = bfr[imgOffset++];
        let r = bfr[imgOffset++];
        let a = bfr[imgOffset++];
        data.data[pxOffset++] = r;
        data.data[pxOffset++] = g;
        data.data[pxOffset++] = b;
        data.data[pxOffset++] = a;
      }
    }
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

var generateBootImage = () => {
  let imgPartSize = (canvas.width * canvas.height * 4) + 0x20;
  let fileSize = imgPartSize + 0x30;
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
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      let colorData = ctx.getImageData(x, y, 1, 1,).data;
      bfr[imgindex++] = colorData[2];
      bfr[imgindex++] = colorData[1];
      bfr[imgindex++] = colorData[0];
      bfr[imgindex++] = colorData[3];
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

  plausible.trackEvent("downloadingBootlogo", { props: { width: canvas.width, height: canvas.height, fileName: currFileName, device: currDevice, sid: sid, dlCount: ncnt } });
  downloadBlob(bfr, 'isp_part.bin', 'application/octet-stream');
};

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

downloadButton.addEventListener("click", event => {
  plausible.trackEvent("bootlogoRequested", { props: { width: canvas.width, height: canvas.height, fileName: currFileName, device: currDevice, sid: sid } });
  generateBootImage();
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