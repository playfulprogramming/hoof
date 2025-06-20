FROM redis:7.4.4-alpine

COPY start-redis-server.sh /usr/bin/start-redis-server.sh
RUN chmod +x /usr/bin/start-redis-server.sh

CMD ["/usr/bin/start-redis-server.sh"]