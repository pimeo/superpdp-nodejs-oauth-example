# Super PDP NodeJS Oauth2 Authentication process.

This project aims to share a NodeJs example of an Oauth2 authentication procedure to the accredited platform (ex PDP) [SuperPDP](https://www.superpdp.tech/). The example is based on the [erp.go](https://github.com/superpdp/examples/blob/main/erp.go) file provided by SuperPDP. This is for development purposes only. You are free to use and modify it.

- [Super PDP authentication documentation](https://www.superpdp.tech/documentation/4)

## Project installation

### Dependencies installation

```
npm install
```

### HTTPS certificate creation

[Inspired from this project to generate a HTTPS express implementation with a custom SSL certificate](https://medium.com/@nitinpatel_20236/how-to-create-an-https-server-on-localhost-using-express-366435d61f28)

```sh
# to get a passphrase, you can visit the page https://randomkeygen.com/ to generate our own
openssl req -x509 -newkey rsa:2048 -keyout keytmp.pem -out cert.pem -days 365

# Extract private key
openssl rsa -in keytmp.pem -out key.pem
```

### Environment variables configurations

```sh
cp .env.example .env
```

Then follow this procedure: 
1. [Register an account ](https://www.superpdp.tech/app/users/create) to SuperPDP website.
2. Choose "Je veux intégrer l’API dans un environnement bac à sable avec des données fictives." option.
3. Once your account is create, click on "Application" to create an application.
4. Choose "Bac à sable" option.
5. Application configurations:
   1. Choose one of two available companies to create your application.
   2. Set field "URLs de redirection" to "https://localhost:8081/callback".
   3. Set field "Type Application" to "Confidentielle".
   4. Copy client id and client secret values into you .env file.

## Serve the project

```
npm run dev
```

## Access to the project

Open https://localhost:8081 into a web browser to attempt to authenticate to the Super PDP service. 
You may have to confirm to the web browser your certificate is trusted.
