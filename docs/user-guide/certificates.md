Certificates & Keystore
============

The OpenHIM has a built in capability to manage TLS certificates and keys through its keystore. You can upload a certificate and key that you have bought from a certificate authority such as Thwate or you can even generate your own self signed certificate to use in your private OpenHIM implementation. Both mechanisms are secure, however we suggest you purchase a certificate from a trusted certificate authority to save you some pain with self signed certificates.

The OpenHIM also allows you to trust particular certificates. This allows you to specify exactly which client or external hosts you trust and it ties in with the OpenHIMs authentication mechanism for clients.

Server certificate & key
------------------

To upload an OpenHIM server certificate simply drag and drop the certificate and key on the correct boxes on the certificates page. You will be asked to restart the OpenHIM for this to take effect. The OpenHIM will also warn you if the key and certificate pair that you have uploaded do not match. DO NOT restart the server if these don't match. It will prevent the server from being able to startup correctly and you will have to fix this manually in the database. If your key requires a passphrase be sure to submit that in the field provided as well.

### Generating a server certificate

To generate a self signed certificate click on the '+ Create Server Certificate' button in the top right. This will guide you through the process of creating an certificate and key and it will automatically add this to the server once you are done. Make sure you download the certificate and key when asked to do so as the key is not stored on the server for security reasons.

Client certificates
-------------------

If you have some client certificates or host certificates that you want the OpenHIM to trust you can add them by simply dropping them in the bottom box to upload them. These certificates may be attached to clients when you edit a particular client from the clients page and enable clients to be authenticated when using mutual TLS. They may also be used on a route when editing a channel to trust a particular hosts certificate.

### Generating a trusted client certificate

You may generate a client certificate by clicking the '+ Create Client Certificate' button and following the steps. Make sure you download the certificate and key when asked to do so as the key is not stored on the server for security reasons.
