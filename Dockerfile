# Works on any container host (Render, Koyeb, Azure/AWS/GCP container services, your own server)
FROM node:20-alpine
WORKDIR /app
COPY package.json server.js index.html ./
RUN chown -R node:node /app
USER node
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
