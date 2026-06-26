#!/bin/bash
sudo sed -i 's/proxy_read_timeout.*/proxy_read_timeout 300s;/g' /etc/nginx/conf.d/elasticbeanstalk/00_application.conf || true
sudo sed -i 's/proxy_connect_timeout.*/proxy_connect_timeout 300s;/g' /etc/nginx/conf.d/elasticbeanstalk/00_application.conf || true
sudo sed -i 's/proxy_send_timeout.*/proxy_send_timeout 300s;/g' /etc/nginx/conf.d/elasticbeanstalk/00_application.conf || true

# If they don't exist in 00_application.conf, append them to the location / block
if ! grep -q "proxy_read_timeout" /etc/nginx/conf.d/elasticbeanstalk/00_application.conf; then
    sudo sed -i '/location \/ {/a \    proxy_read_timeout 300s;\n    proxy_connect_timeout 300s;\n    proxy_send_timeout 300s;' /etc/nginx/conf.d/elasticbeanstalk/00_application.conf
fi

sudo systemctl reload nginx
