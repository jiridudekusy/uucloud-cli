const path = require("path");
const fs = require("fs");
const PropertiesReader = require("properties-reader");
const Got = require("got");
const Jwt = require("jsonwebtoken");
const GetPem = require("rsa-pem-from-mod-exp");
const OidcClient = require("./oidc-client");

const GRANT_TOKEN_UC = "grantToken";

class OidcToken {
    constructor(tokenFile, config) {
        this.tokenPath = this._resolveTokenPath(tokenFile);
        this._oidcClient = new OidcClient(config);
    }

    async refresh() {
        if (this.token || !(await this._loadTokenFromFile())) {
            await this._interactiveLogin();
        }
        return this.token;
    }

    async get() {
        if (this.token == null) {
            await this.refresh();
        }
        return this.token;
    }

    _setToken(token) {
        this.token = "Bearer " + token;
        return this.token;
    }

    async _loadTokenFromFile() {
        if (!fs.existsSync(this.tokenPath)) {
            return false;
        }

        var properties = PropertiesReader(this.tokenPath);
        if (properties.get("id_token")) {
            let token = properties.get("id_token");
            let valid = await this._verifyTokenExpiration(token);
            if (valid) {
                this._setToken(token);
                //console.log("Auth: Using token from file.");
                return true;
            } else {
                //console.log("Auth: Token from file is not valid or expired.");
                return false;
            }

        } else if (properties.get("accessCode1") && properties.get("accessCode2")) {
            return await this._login(properties.get("accessCode1"), properties.get("accessCode2"));
        }

        return false;
    }

    async _verifyTokenExpiration(token) {
        let parsedToken = Jwt.decode(token, {complete: true});
        try {
            let publicKeyData = await this._oidcClient.getPublicKeyData(parsedToken.header.kid);
            let publicKey = GetPem(publicKeyData.n, publicKeyData.e);
            let verificationOptions = {};
            verificationOptions["issuer"] = await this._oidcClient.getMetadata()["issuer"];
            verificationOptions["algorithms"] = publicKeyData.alg;
            verificationOptions["clockTolerance"] = 5;
            verificationOptions["maxAge"] = 5400; //90min
            Jwt.verify(token, publicKey, verificationOptions);
        } catch (e) {
            // Token not valid or expired
            return false;
        }
        return true;
    }

    async _interactiveLogin() {
        if (this._oidcClient.isInteractiveLoginAvailable()) {
            console.log("Auth: Starting interactive login process.");
            let token = await this._oidcClient.interactiveLogin();

            console.log("> Token obtained.");

            try {
                let dirname = path.dirname(this.tokenPath);
                if (!fs.existsSync(dirname)) {
                    fs.mkdirSync(dirname);
                }
                fs.writeFileSync(this.tokenPath, `id_token=${token}`, "utf-8");
            } catch (e) {
                console.log("> Unable to save token to provided location: " + this.tokenPath);
            }

            return this._setToken(token);
        } else {
            throw new Error("Password file not provided and interactive login can't be used in you environment.");
        }
    }

    async _login(accessCode1, accessCode2) {
        //console.log("Auth: Login using access codes from file.");

        let result;
        try {
            result = await Got.post(`${this._oidcClient.getOidcUri()}/${GRANT_TOKEN_UC}`, {
                headers: {
                    "Accept": "application/json",
                    "Content-type": "application/json"
                },
                body: JSON.stringify({
                    accessCode1,
                    accessCode2,
                    grant_type: "password",
                    scope: "openid https:// http://"
                })
            });
        } catch (e) {
            if (e.statusCode == 401) {
                console.log("> Login failed: Access codes in provided password file are not valid.");
            } else {
                console.log("> Login failed: " + e.message);
            }

            return false;
        }

        this._setToken(JSON.parse(result.body).id_token);
        //console.log("> Login successful.");
        return true;
    }

    _getTokenDefaultPath(projectRoot) {
        let useTargetDir = true;
        let gitignore = null;
        if (fs.existsSync(gitignore = path.resolve(projectRoot, '.gitignore'))) {
            useTargetDir = !(fs.readFileSync(gitignore).toString().match(/\.devkit-token/));
        }
        if (useTargetDir && fs.existsSync(gitignore = path.resolve(projectRoot, '..', '.gitignore'))) {
            useTargetDir = !(fs.readFileSync(gitignore).toString().match(/\.devkit-token/));
        }
        if (useTargetDir) {
            return path.resolve(projectRoot, "target", ".devkit-token");
        } else {
            return path.resolve(projectRoot, ".devkit-token");
        }
    }

    _resolveTokenPath(tokenFile) {
        if (fs.existsSync(tokenFile)) {
            return tokenFile;
        }

        if (process.env.UU_HOME) {
            let p = path.join(process.env.UU_HOME, tokenFile);
            if (fs.existsSync(p)) {
                return p;
            }
        }

        if (process.env.HOME) {
            let p = path.join(process.env.HOME, ".uu", tokenFile);
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return tokenFile;
    }
}

module.exports = OidcToken;
