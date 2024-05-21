import './shoelace-components';
import './styles.scss';



let isWorldSaved: boolean = false;

export function saveTheWorld(): string {
  if (isWorldSaved) {
    return `Too late, world has already been saved`;
  } else {
    isWorldSaved = true;
    return `Hurray, you just saved the world`;
  }
}


saveTheWorld();