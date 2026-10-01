FROM nginx:1.27-alpine
ARG KERJADESA_API_BASE=/api
COPY . /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/nginx.conf
RUN sed -i "s#window.KERJADESA_API_BASE = window.KERJADESA_API_BASE || '/api';#window.KERJADESA_API_BASE = '${KERJADESA_API_BASE}';#" /usr/share/nginx/html/js/deployment-config.js
RUN printf '%s\\n' '<!-- KerjaDesa frontend -->' > /usr/share/nginx/html/.kerjadesa-build
EXPOSE 80
