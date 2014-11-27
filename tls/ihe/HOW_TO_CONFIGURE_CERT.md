How to setup OpenHIM with the IHE certs
=======================================

1. Copy cert.pem and key.pem to the /tls folder
2. Create a client ensure the client domain name equals the dn of the client, cert can be anything it doesn't get checked...
3. Create another client with the CA certificate. It doesn't matter what this clients is called. It just adds the CA cert to the list of CAs in node.