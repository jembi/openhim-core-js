
# Setup and Configuration

## OpenHIM Basic Configuration

Two very important parts of the OpenHIM console are the clients and channels where both are essential for enabling the routing of messages through the system. Before you get started with clients and channels, you will need the OpenHIM core and OpenHIM console installed and configured. Please see section 4.1 which discusses this process.

### What is a Client?

A client is usually some system that you want to able to send request to the OpenHIM. Setting up a client allows the OpenHIM to authenticate requests.

### What is a Channel?

A Channel defines a path that a request will take through the OpenHIM. It describes one or more routes for the request to be forwarded to, which clients are allowed to use the channel, which requests are to be directed to this channel and many more options that allows you to control what happens for a particular request.
The management of clients and channels are discussed later in the document. Only an OpenHIM administrative user has the permission to Add, Edit and Delete a Client or Channel
