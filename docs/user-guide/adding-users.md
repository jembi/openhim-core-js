Adding Users
============

### Overview

In order to use the OpenHIM you have to be a registered user with the relevant permissions:
A default super/admin user is provided when you first run the OpenHIM


The default admin user is a as follows:

username: root@openhim.org
password: openhim-password

NB: It is recommended that you change these as soon as you have installed the him to avoid abuse.

**Other users:**
Using the default admin user, you may create other users. these too may belong to the admin group or may belong to other groups. 

NB: Users that belong to the admin group are Super Users.

**Purpose:**

Users accounts are created in order to give users of the system an certain capabilities depending on the groups to which they belong. Users can access these capabilities through the OpenHIM console

### Differentiate from API clients:

Clients are different from users, they represent systems that can route transactions through the OpenHIM further details  are provided in [this section](https://github.com/jembi/openhim-console/wiki/Getting-started-guide#clients) 

### User Groups:

Groups can be created by just adding that group as a text string in the user form. When you go on to create the channel, you just need to make sure the group matches the one you specified when you created the user.

There are 2 kinds of group

1. The 'admin' group this one is the super user group that grants users all permissions
2. Then the rest are defined by the system administrator and in the channels, an admin can 
set whether the group has any the Roles below.

### Roles

Users belonging to a certain group can be assigned certain roles on a channel depending on the desired permissions. This is done by adding the group to which they belong to that particular
role.

The roles themselves are pretty self explanatory and are listed below with some brief explanations.

1. Can view channel transactions
2. Can view channel transaction bodies - bodies may contain private patient data
3. Can re-run transactions. - this needs to be done with good reason because it may cause downstream duplicates and data corruption.

Also on the users page, there is a matrix that shows these permissions and can be viewed by clicking the button above the list of users.

### Walk through and examples

1. To add a user as an admin user, navigate to the admin section and click the button to add the user.

Required fields, are as follows:

1. Email - This needs to be a valid and unique email address
2. First Name 
3. Last Name
4. Groups
5. Password and Confirm Password

Optional Fields are as follows:

1. MSISDN - the users cellphone number in the MSISDN format (eg. 27825555555) should you want to receive sms alerts
2. Receive daily reports, via email
3. Receive weekly reports, via email
4. Filter & List settings: here you may pre-define how you want to view your transactions

## Reports

The two kinds of reports mentioned above send transaction metrics aggregated over a period. In these reports, you can see, the number of transactions that went through as well as their statuses.

The statuses are as follows:  

1. Failed
2. Processing
3. Completed
4. Completed with errors
5. Successful

## Filter and list settings

1. Filter settings: Here you set how you want to view transactions on the Transactions page by default. You can default it to show transactions by status by channel as well as limit the number of transactions per page.

2. List settings: Upon clicking on a transaction in the transactions page, you can choose by default whether to view the transaction on the same page, or to open it in a new window altogether.

If you have any questions that are not covered in this guide, please [submit an issue](https://github.com/jembi/openhim-console/issues/new) with the 'documentation' label and we will strive to add it to this page.


