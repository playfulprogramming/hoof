FROM redis:8.2.1-alpine3.22

COPY start-redis-server.sh /usr/bin/start-redis-server.sh
RUN chmod +x /usr/bin/start-redis-server.sh

CMD ["/usr/bin/start-redis-server.sh"]
