# Livekeeping Data Connector

Path: `C:\Users\Hp\AppData\Local\Livekeeping Technologies Private Limited\LKDataConnector`

## Files
```

Path                                         Length  Modified   Version     
----                                         ------  --------   -------     
\files                                               2026-10-26             
\logs                                                2026-10-01             
\x64                                                 2026-10-01             
\x86                                                 2026-10-01             
\AWSSDK.Core.dll                             1892000 2026-09-30 3.7.106.21  
\AWSSDK.S3.dll                               841376  2026-09-30 3.7.103.51  
\Hardcodet.NotifyIcon.Wpf.dll                107952  2026-09-30 1.1.0.17    
\livekeeping-logo.ico                        21662   2026-09-30             
\Microsoft.Web.WebView2.Core.dll             456120  2026-09-30 1.0.1722.45 
\Microsoft.Web.WebView2.WinForms.dll         38312   2026-09-30 1.0.1722.45 
\Microsoft.Web.WebView2.Wpf.dll              44456   2026-09-30 1.0.1722.45 
\MongoDB.Bson.dll                            464304  2026-09-30 2.7.3.0     
\Newtonsoft.Json.dll                         711952  2026-09-30 13.0.3.27908
\NLog.config                                 4845    2026-09-30             
\NLog.dll                                    935424  2026-09-30 5.2.2.1914  
\NotificationTool.dll                        117040  2026-09-30 1.0.0.0     
\setup-image.bmp                             3905046 2026-09-30             
\System.Buffers.dll                          20864   2026-09-30 4.6.28619.01
\System.Data.SQLite.dll                      459960  2026-09-30 1.0.119.0   
\TallyDataConnector.exe                      7739424 2026-09-30 3.2.1.3     
\unins000.dat                                35151   2026-10-01             
\unins000.exe                                4472694 2026-10-01 51.1054.0.0 
\uninstall.conf                              96      2026-10-01             
\Updater.exe                                 107440  2026-09-30 3.1.3.0     
\user.conf                                   100     2026-10-01             
\Xceed.Wpf.Toolkit.dll                       1212416 2026-09-30 4.5.0.0     
\files\100003                                        2026-10-01             
\files\100005                                        2026-10-26             
\files\100008                                        2026-10-22             
\files\100011                                        2026-10-15             
\files\lkdc.db                               90112   2026-10-26             
\files\100003\Outstandings_20250401_20260331         2026-10-01             
\files\100003\Outstandings_20260401_20270331         2026-10-01             
\files\100003\Profit_loss_20250401_20260331          2026-10-01             
\files\100003\Profit_loss_20260401_20270331          2026-10-01             
\files\100003\067c13b2c7ead4c98acd1          224682  2026-10-01             
\files\100003\067c13b2c7ead4ccfd849          3748    2026-10-01             
\files\100003\067c13b2c7ead4d985fdf          115897  2026-10-01             
\files\100003\067c13b2c7ead4dfeecd1          3478    2026-10-01             
\files\100008\Outstandings_20260401_20270331         2026-10-22             
\files\100008\Profit_loss_20260401_20270331          2026-10-22             
\files\100008\aa2c12b2c5dab50d70451          3224    2026-10-22             
\files\100008\aa2c12b2c5dab50d7b73c          503     2026-10-22             
\files\100011\Outstandings_20260401_20270331         2026-10-15             
\files\100011\Profit_loss_20260401_20270331          2026-10-15             
\files\100011\83661fa76d8c7ed621a0e          3596    2026-10-15             
\files\100011\83661fa76d8c7ed62710e          223     2026-10-15             
\logs\datapath.json                          233     2026-10-26             
\logs\syncingLogger.log                      806405  2026-10-26             
\logs\tdcActivityOffline.log                 0       2026-10-26             
\logs\tdcLog.log                             0       2026-10-26             
\x64\SQLite.Interop.dll                      1987256 2026-09-30 1.0.119.0   
\x86\SQLite.Interop.dll                      1632952 2026-09-30 1.0.119.0   



```
## user.conf (redacted)
```
692bdb21d929c5e7d6653b9c
6mnGelATR3hKVzvetofWlk6ycn4BLgJ4BPldrpiTxmpFSr8e9hV9wuSnZ2JJ74lwO+2e
$$

```
## uninstall.conf (redacted)
```
692bdb21d929c5e7d6653b9c$$6mnGelATR3hKVzvetofWlk6ycn4BLgJ4BPldrpiTxmpFSr8e9hV9wuSnZ2JJ74lwO+2e

```
## NLog.config (redacted)
```
<?xml version="1.0" encoding="utf-8" ?>
<nlog xmlns="http://www.nlog-project.org/schemas/NLog.xsd"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" throwConfigExceptions="true">

		<targets async="true">
			<target name="SyncingLogger" xsi:type="File" fileName="${basedir}/logs/syncingLogger.log" layout="${longdate} ${message}"
                    keepFileOpen="true" concurrentWrites="true" archiveAboveSize="1048576" maxArchiveFiles="1"/>
			<target name="groupTarget" xsi:type="FallbackGroup" returnToFirstOnSuccess="true">
				<target name="netTarget" xsi:type="Network" address="udp://devtallyconnector.livekeeping.com:5000" newLine="true">
				<layout xsi:type="JsonLayout" IncludeScopeProperties="true">
					<attribute name="systemDateTime" layout="${date:format=O}" />
					<attribute name="functionName" layout="${message}" />
					<attribute name="logger" layout="${logger}"/>
					<attribute name="level" layout="${level}"/>
					<attribute name="exception" encode="false">
						<layout xsi:type="JsonLayout">
							<attribute name="type" layout="${exception:format=type}" />
							<attribute name="message" layout="${exception:format=message}" />
							<attribute name="stacktrace" layout="${exception:format=tostring}" />
						</layout>
					</attribute>
				</layout>
			</target>				
				<target name="fileTarget" xsi:type="File" keepFileOpen="false" concurrentWrites="true" fileName="${basedir}/logs/tdcLog.log"
     archiveAboveSize="200000" maxArchiveFiles="2">
				<layout xsi:type="JsonLayout" IncludeScopeProperties="true">
					<attribute name="systemDateTime" layout="${date:format=O}" />
					<attribute name="functionName" layout="${message}" />
					<attribute name="logger" layout="${logger}"/>
					<attribute name="level" layout="${level}"/>
					<attribute name="exception" encode="false">
						<layout xsi:type="JsonLayout">
							<attribute name="type" layout="${exception:format=type}" />
							<attribute name="message" layout="${exception:format=message}" />
							<attribute name="stacktrace" layout="${exception:format=tostring}" />
						</layout>
					</attribute>
				</layout>
			</target>
			</target>
			<target xsi:type="FallbackGroup" name="tcpTargetGroup" returnToFirstOnSuccess="true">						
				<target name="tcpTarget" xsi:type="Network" address="tcp://devtallyconnector.livekeeping.com:5001" newLine="true">
					<layout xsi:type="JsonLayout" IncludeScopeProperties="true">
								<attribute name="msg" layout="${event-properties:msg}" />
								<attribute name="_userId" layout="${event-properties:_userId}" />
								<attribute name="description" layout="${event-properties:description}" />
								<attribute name="requestFrom" layout="${event-properties:requestFrom}" />
								<attribute name="createdAt" layout="${event-properties:createdAt}" />
								<attribute name="company_id"   layout="${event-properties:company_id}"/>
								<attribute name="customerStatus" layout="${event-properties:customerStatus}"/>
								<attribute name="customerSource" layout="${event-properties:customerSource}"/>
								<attribute name="macAddress" layout="${event-properties:macAddress}" />
								<attribute name="sessionId" layout="${event-properties:sessionId}" />
								<attribute name="desktopVersion" layout="${event-properties:desktopVersion}" />
						
					</layout>
				</target>
						<target xsi:type="File" name="fileBackup"
							  fileName="${basedir}/logs/tdcActivityOffline.log" keepFileOpen="false" concurrentWrites="true"  archiveAboveSize="500000" maxArchiveFiles="2">
							<layout xsi:type="JsonLayout" IncludeScopeProperties="true" >
								<attribute name="msg" layout="${event-properties:msg}" />
								<attribute name="_userId" layout="${event-properties:_userId}" />
								<attribute name="description" layout="${event-properties:description}" />
								<attribute name="requestFrom" layout="${event-properties:requestFrom}" />
								<attribute name="createdAt" layout="${event-properties:createdAt}" />
								<attribute name="company_id"   layout="${event-properties:company_id}"/>
								<attribute name="customerStatus" layout="${event-properties:customerStatus}"/>
								<attribute name="customerSource" layout="${event-properties:customerSource}"/>
								<attribute name="macAddress" layout="${event-properties:macAddress}" />
								<attribute name="sessionId" layout="${event-properties:sessionId}" />
								<attribute name="desktopVersion" layout="${event-properties:desktopVersion}" />
								
							</layout>
						</target>
				
				</target>
		</targets>
		<rules>
			<logger name="SyncingLogger" minlevel="Info" writeTo="SyncingLogger" />
			<logger name="AppLogger" minlevel="Trace" writeTo="groupTarget" />
			<logger name="ActivityLogger" minlevel="Info" writeTo="tcpTargetGroup" />
		</rules>
	</nlog>
```
## logs\datapath.json (redacted)
```
{
  "69984cdfc56aaf7c3d11e1f9": [
    "2026-10-14T00:00:00Z",
    "2026-10-17T00:00:00Z"
  ],
  "6a48a4063ac5cdc66c481d34": [
    "2026-10-15T00:00:00Z"
  ],
  "6a9e49373ac5cdc66cd14091": [
    "2026-10-25T00:00:00Z"
  ]
}
```
## Local DB schema (files\lkdc.db)
```sql
CREATE TABLE notification (
                    notificationType TEXT,
                    company_id TEXT,
                    lastNotificationDate TEXT,
                    retryCount INTEGER,
                    PRIMARY KEY (notificationType, company_id)
```
## Log patterns: tdcLog.log (last 20k lines, digits masked)
```

```
## Log patterns: syncingLogger.log (last 20k lines, digits masked)
```

Count Name                                                                                   
----- ----                                                                                   
 1882 <TS> Uploading Outstanding 9 (9/9)                                                     
 1276 <TS> Uploading Masters (9/9)                                                           
  752 <TS> Uploading Reports 9 (9/9)                                                         
  644 <TS> Uploading Vouchers (9/9)                                                          
  310 <TS> CurrentViewName: TallyConfig, TargetViewName: Companies                           
  280 <TS> CurrentViewName: Companies, TargetViewName: TallyConfig                           
  249                                                                                        
  247 <TS>                                                                                   
  236 <TS> Uploading Completed                                                               
  146 <TS> Same View Clicked - Skipping                                                      
  134 <TS> CurrentViewName: Default, TargetViewName: Loader                                  
  134 <TS> CurrentViewName: Loader, TargetViewName: Loader                                   
  124 <TS> Uploading Vouchers...                                                             
  124 <TS> Sync completed with no tally operation found.                                     
  122 <TS> stockItemNamesForReport.Count:9                                                   
  122 <TS> ledgerNamesForReport.Count:9                                                      
  121 <TS> =====================GARDEN TRADERS {COMPANY} -(9-9)==========================       
  113 <TS> Report:outstandings, Ledgers Count:9                                              
  113 <TS> Uploading Reports (9/9)                                                           
  113 <TS> Report:outstandings, Before ledgers list filter Count:9                           
  113 <TS> Uploading Outstanding 9                                                           
  112 <TS> DeleteMasters_gstclassification::DBCount:9, TallyCount:9                          
  112 <TS> DeleteMasters_group::DBCount:9, TallyCount:9                                      
  112 <TS> DeleteMasters_ledger::DBCount:9, TallyCount:9                                     
  112 <TS> DeleteMasters_costcentre::DBCount:9, TallyCount:9                                 
  112 <TS> DeleteMasters_taxunit::DBCount:9, TallyCount:9                                    
  112 <TS> DeleteMasters_costcategory::DBCount:9, TallyCount:9                               
  112 <TS> DeleteMasters_tdsrate::DBCount:9, TallyCount:9                                    
  112 <TS> DeleteMasters_currency::DBCount:9, TallyCount:9                                   
  112 <TS> DeleteMasters_unit::DBCount:9, TallyCount:9                                       
  112 <TS> DeleteMasters_stockgroup::DBCount:9, TallyCount:9                                 
  112 <TS> DeleteMasters_stockitem::DBCount:9, TallyCount:9                                  
  112 <TS> DeleteMasters_stockcategory::DBCount:9, TallyCount:9                              
  112 <TS> DeleteMasters_godown::DBCount:9, TallyCount:9                                     
  112 <TS> DeleteMasters_vouchertype::DBCount:9, TallyCount:9                                
  108 <TS> "â€¦"|"â€¦"                                                                       
   98 <TS> CurrentViewName: Loader, TargetViewName: TallyConfig                              
   82 <TS> Uploading Vouchers GstR (9/9)                                                     
   77 <TS> Error:Tally Disconnected                                                          
   68 <TS> =====================New {COMPANY} Traders. -9-9==========================         
   66 <TS> CurrentViewName: Loader, TargetViewName: NoInternet                               
   56 <TS> CurrentViewName: Companies, TargetViewName: NoInternet                            
   56 <TS> CurrentViewName: TallyConfig, TargetViewName: NoInternet                          
   55 <TS> =====================M/s.Bharat Trading Co. - 9-9==========================       
   53 <TS> CurrentViewName: NoInternet, TargetViewName: Loader                               
   36 <TS> Uploading StockItems (9/9)                                                        
   34 <TS> Uploading GstR (9/9)                                                              
   31 <TS> DeleteVouchers:: TallyLastAlterVoucherId:9, ExportedVchMaxAlterId:9, ExportCount:9
   29 <TS> CurrentViewName: NoInternet, TargetViewName: TallyConfig                          
   27 <TS> DeleteVouchers:: DBCount:9, TallyCount:9, ExportCount:9,NewCount:9                
   25 <TS> Object:stockitem,Count:9,AltCount:9                                               
   23 <TS> CurrentViewName: Loader, TargetViewName: Companies                                
   21 <TS> Uploading Report9 9 (9/9)                                                         
   21 <TS> Uploading Ledgers (9/9)                                                           
   16 <TS> Object:ledger,Count:9,AltCount:9                                                  
   11 <TS> CurrentViewName: NoInternet, TargetViewName: NoInternet                           
   10 <TS> Object:vouchertype,Count:9,AltCount:9                                             
    7 <TS> CurrentViewName: NoInternet, TargetViewName: Companies                            
    6 <TS> Wait 9 minutes to complete the previous syncing process in consumer.              
    6 <TS> Object:gstRegistration,Count:9,AltCount:9                                         



```
## Log patterns: tdcActivityOffline.log (last 20k lines, digits masked)
```

```
