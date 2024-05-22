import './shoelace-components';
import './styles.scss';

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

interface IResolution {
  w: number;
  h: number;
}

var resolutions: { [device: string]: IResolution} = {
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
var noWarrantyDialog = <SlDialog>document.getElementById("no-warranty-dialog");
var noWarrantyDialogClose = <SlButton>document.getElementById("no-warranty-dialog-close");
var recommendedWidth = document.getElementById("recommended-width");
var recommendedHeight = document.getElementById("recommended-height");

modelSelect.addEventListener("sl-change", event => {
  let val = <string>(event.target as SlSelect).value;
  let res = resolutions[val];
  if (!res)
    return;
  currDevice = val;
  let width = res.w;
  let height = res.h;
  canvas.width = width;
  canvas.height = height;
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
  plausible.trackEvent("modelSelected", { props: { resolution: `${width}x${height}`, device: val } });
});

imageUploader.addEventListener("sl-change", event => {
  var files = (event.target as SlInput).input.files;
  if (files && files[0]) {
    let file = files[0];
    plausible.trackEvent("imageUploaded", { props: { fileName: file.name, device: currDevice } });
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
});

downloadButton.addEventListener("click", event => {
  plausible.trackEvent("bootlogoRequested", { props: { width: canvas.width, height: canvas.height, fileName: currFileName, device: currDevice } });
  generateBootImage();
});

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

var generateBootImage = () => {
  let imgPartSize = (canvas.width * canvas.height * 4) + 0x20;
  let fileSize = imgPartSize + 0x30;
  let bfr = new Uint8Array(fileSize);
  writeString(bfr, 0, 'PART');
  writeUint32(bfr, 4, fileSize);
  writeUint32(bfr, 8, 0x10);
  writeUint32(bfr, 12, 0x20);
  writeString(bfr, 16, 'logo.bin');
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

  plausible.trackEvent("downloadingBootlogo", { props: { width: canvas.width, height: canvas.height, fileName: currFileName, device: currDevice } });
  downloadBlob(bfr, 'isp_part.bin', 'application/octet-stream');
};

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

noWarrantyDialogClose.addEventListener('click', _ => {
  noWarrantyDialog.hide();
  plausible.trackEvent("warrantyWarningClosed");
});

noWarrantyDialog.show();