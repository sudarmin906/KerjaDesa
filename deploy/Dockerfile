FROM nginx:1.27-alpine
ARG KERJADESA_API_BASE=/api
COPY . /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/nginx.conf
RUN printf '%s\n' '<!-- KerjaDesa frontend -->' > /usr/share/nginx/html/.kerjadesa-build
EXPOSE 80
