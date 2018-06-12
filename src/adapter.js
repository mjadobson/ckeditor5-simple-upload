export default class Adapter {
    constructor(loader, url, t) {
        this.loader = loader;
        this.url = url;
    }

    upload() {
        return this.getCredentials().then(this.uploadImage.bind(this));
    }

    abort() {
        if (this.xhr) this.xhr.abort();
    }

    getCredentials() {
        return new Promise((resolve, reject) => {

            var filename = this.loader.file.name;

            if (!filename) return reject('No filename found');

            var xhr = new XMLHttpRequest();
            
            xhr.withCredentials = true;
            xhr.open('GET', this.url + '?filename=' + filename, true);
            xhr.responseType = 'json';
            xhr.setRequestHeader('Content-Type', 'application/json');
            
            xhr.addEventListener('error', err => reject('crederr'));
            xhr.addEventListener('abort', err => reject('credabort'));
            xhr.addEventListener('load', function () {
                var res = xhr.response;
                
                if (!res) return reject('No response from s3 creds url');

                resolve(res);
            });

            xhr.send();

        });
    }

    uploadImage(s3creds) {
        return new Promise((resolve, reject) => {

            var data = new FormData();

            for (var param in s3creds.params) {
                if (!s3creds.params.hasOwnProperty(param)) continue;

                data.append(param, s3creds.params[param]);
            }

            data.append('Content-Type', this.loader.file.type)

            data.append('file', this.loader.file);
            
            var xhr = this.xhr = new XMLHttpRequest();
            
            xhr.withCredentials = false;
            xhr.responseType = 'document';
            
            xhr.addEventListener('error', err => reject('s3err'));
            xhr.addEventListener('abort', err => reject('s3abort'));
            xhr.addEventListener('load', () => {
                const res = xhr.response;
                
                if (!res) return reject('No Response');
    
                if (res.querySelector('Error')) {
                    return reject(res.querySelector('Code').textContent + ': ' + res.querySelector('Message').textContent);
                }

                var url = res.querySelector('Location').textContent;

                if (!url) {
                    return reject('NoLocation: No location in s3 POST response');
                }

                resolve({ default: url });
            });

            if (xhr.upload) {
                xhr.upload.addEventListener('progress', e => {
                    if (!e.lengthComputable) return;
                    
                    this.loader.uploadTotal = e.total;
                    this.loader.uploaded = e.loaded;
                });
            }

            xhr.open('POST', s3creds.endpoint_url, true);
            xhr.send(data);

        });
    }
}
