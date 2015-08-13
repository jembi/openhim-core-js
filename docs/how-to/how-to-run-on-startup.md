How to run the OpenHIM on startup
---------------------------------

To help you get the OpenHIM server running on boot we supply a upstart config file (good for Ubuntu or other system that use upstart). Install the upstart config by doing the following:

```
wget https://raw.githubusercontent.com/jembi/openhim-core-js/master/resources/openhim-core.conf
sudo cp openhim-core.conf /etc/init/
```

Then run start the server with:

`sudo start openhim-core`

It will automatically startup on reboot.

If you require custom config you will have to edit `openhim-core.conf` to add in the `--conf` parameter pointing to your external config file.