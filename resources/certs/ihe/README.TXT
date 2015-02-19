#*******************************************************************************
# README.TXT                                                           R Moulton
# ReadMe file for IHE Pre-Connectathon and Connectathon Certificate Generation.
# 2015 and 2016 Connectathons
#*******************************************************************************

The contents of this (cert.zip) file were created by the Certificate generation 
software using the parameter values you entered on the web application form. 
Commands are in Linux format. You will not need all of these files, and you may
need other files than these, depending on your software.  These files are 
provided for the convenience of various different types of developers.  If you
have suggestions on how to improve this distribution, email them to Ralph
Moulton at moultonr@mir.wustl.edu.

Contents of the cert.zip file:

dn.txt - Contains the entries you gave in the Certificate Generation web 
   application, and which were used to generate your certificates. 
   
password.txt - A text file containing your password. In the commands below, the
   appearance of pw is understood to be replaced with the password in this file.
            
key.pem - Your private key, in PEM format. Generated using:

   openssl genrsa -out key.pem 1024
   
cert.pem - Your certificate, in PEM format. Generated using:

   openssl req -new -key key.pem -out csr -in dn.txt
   openssl x509 -req -inform PEM -in csr -days 435 -CA cacert.pem -keyform PEM \
      -CAkey cakey.pem -set_serial sn -out cert.pem
      
   where cacert.pem is the CA certificate you selected on the web application
   form, from those listed below cacert.MIR2014-16.pem, cakey.pem is the private 
   key of that certificate, and sn is an incremental serial number. The 
   certificate request file (csr) is deleted afterwards.
              
cacert.MIR2014-16.pem - The CA certificate for 2015 and 2016 connectathons. 
   Software for these connectathons will have to accept certificates signed by 
   this certificate.
            
cert.p12 - A PKCS12 file containing your private key and certificate, in PEM 
   format. Generated using:
   
   openssl pkcs12 -export -in cert.pem -inkey key.pem -out cert.p12 \
      -passout pass:pw  
   
keystore.jks - A java keystore file in JKS format containing your certificate 
   and key and the CA certificates. Generated using:   
  
   keytool -import -trustcacerts -file cacert.MIR2014-16.pem \ 
      -keystore keystore.jks -storepass pw -alias MIR2014-16
   keytool -importkeystore -srckeystore cert.p12 -destkeystore keystore.jks \
      -srcstoretype PKCS12 -deststoreType JKS -srcstorepass pw \
      -deststorepass pw
      