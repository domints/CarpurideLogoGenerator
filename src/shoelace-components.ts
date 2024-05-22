import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/themes/dark.css';

import SlAlert from '@shoelace-style/shoelace/dist/components/alert/alert.js';
import SlButton from '@shoelace-style/shoelace/dist/components/button/button.js';
import SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import SlInput from '@shoelace-style/shoelace/dist/components/input/input.js';
import SlOption from '@shoelace-style/shoelace/dist/components/option/option.js';
import SlSelect from '@shoelace-style/shoelace/dist/components/select/select.js';
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
setBasePath("shoelace");

let components_mock = [
    SlAlert.version,
    SlButton.version,
    SlDialog.version,
    SlInput.version,
    SlOption.version,
    SlSelect.version
]