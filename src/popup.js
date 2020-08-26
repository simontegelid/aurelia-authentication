import {PLATFORM, DOM} from 'aurelia-pal';
import {parseQueryString} from 'aurelia-path';
import extend from 'extend';

export class Popup {
  constructor() {
    this.popupWindow = null;
    this.polling     = null;
    this.url         = '';
  }

  open(url: string, windowName: string, options?: {}): Popup {
    this.url = url;
    const optionsString = buildPopupWindowOptions(options || {});

    this.popupWindow = PLATFORM.global.open(url, windowName, optionsString);

    if (this.popupWindow && this.popupWindow.focus) {
      this.popupWindow.focus();
    }

    return this;
  }

  eventListener(redirectUri: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.popupWindow.addEventListener('loadstart', event => {
        if (!uriEqual(event.url, redirectUri)) {
          return;
        }

        const parser  = DOM.createElement('a');

        parser.href = event.url;

        if (parser.search || parser.hash) {
          const qs = parseUrl(parser);

          if (qs.error) {
            reject({error: qs.error});
          } else {
            resolve(qs);
          }

          this.popupWindow.close();
        }
      });

      this.popupWindow.addEventListener('exit', () => {
        reject({data: 'Provider Popup was closed'});
      });

      this.popupWindow.addEventListener('loaderror', () => {
        reject({data: 'Authorization Failed'});
      });
    });
  }

  pollPopup(redirectUri: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.polling = PLATFORM.global.setInterval(() => {
        let errorData;

        try {
          let popupWinLoc = this.popupWindow.location;
          let popupWinUri = popupWinLoc.origin + popupWinLoc.pathname;

          if (uriEqual(popupWinUri, redirectUri)) {
            const qs = parseUrl(this.popupWindow.location);

            if (qs.error) {
              reject({error: qs.error});
            } else {
              resolve(qs);
            }

            this.popupWindow.close();
            PLATFORM.global.clearInterval(this.polling);
          }
        } catch (error) {
          errorData = error;
        }

        if (!this.popupWindow) {
          PLATFORM.global.clearInterval(this.polling);
          reject({
            error: errorData,
            data : 'Provider Popup Blocked'
          });
        } else if (this.popupWindow.closed) {
          PLATFORM.global.clearInterval(this.polling);
          reject({
            error: errorData,
            data : 'Problem poll popup'
          });
        }
      }, 35);
    });
  }

}

const buildPopupWindowOptions = (options: {}): string => {
  const width  = options.width || 500;
  const height = options.height || 500;

  const extended = extend({
    width : width,
    height: height,
    left  : PLATFORM.global.screenX + ((PLATFORM.global.outerWidth - width) / 2),
    top   : PLATFORM.global.screenY + ((PLATFORM.global.outerHeight - height) / 2.5)
  }, options);

  let parts = [];

  Object.keys(extended).map(key => parts.push(key + '=' + extended[key]));

  return parts.join(',');
};

const parseUrl = (url: string): {} => {
  let hash = (url.hash.charAt(0) === '#') ? url.hash.substr(1) : url.hash;

  return extend(true, {}, parseQueryString(url.search), parseQueryString(hash));
};

const uriEqual = (uri1: string, uri2: string): Boolean => {
  if (uri1.endsWith('/')) {
    uri1 = uri1.slice(0, -1);
  }
  if (uri2.endsWith('/')) {
    uri2 = uri2.slice(0, -1);
  }

  return uri1 === uri2;
}
