# TallyIra (Tally's built-in AI agent, ships with 7.x)

Path: `C:\Users\Hp\AppData\Local\TallyIra`

`cache\*.keys` and `tallyira_sessions.bin` exist. **Not captured (credentials).**

## Files
```

Path                                               Length   Modified   Version
----                                               ------   --------   -------
\3_1_0_b907209af30.2026-10-13                               2026-10-20        
\cache                                                      2026-10-22        
\logs                                                       2026-10-01        
\3_1_0_b907209af30.2026-10-13\tallyagent.exe       3680448  2026-10-14        
\3_1_0_b907209af30.2026-10-13\tallyagent_crash.dmp 10636690 2026-10-24        
\logs\tally_agent.log                              5200825  2026-10-26        



```
## tally_agent.log patterns (last 20k lines)
```

Count Name                                                                                                                                                            
----- ----                                                                                                                                                            
 9172                                                                                                                                                                 
 4364 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |    Event Client | Error receiving UDP message, resetting receive loop ...                                            
 4364 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |    Event Client | Error receiving UDP message: 9 | An operation on a socket could not be performed because the system
  167 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |     Main Thread | Data processing failed.                                                                            
  164 [<TS>] | WARNING  | 9.9.9 (b9e9b9.9-9-9) |     Main Thread | Send Message failed.                                                                               
  147 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |     Main Thread | Data processing failed.                                                                             
  146 [<TS>] | WARNING  | 9.9.9 (b9af9.9-9-9) |     Main Thread | Send Message failed.                                                                                
   99 [<TS>] | WARNING  | 9.9.9 (b9e9b9.9-9-9) | localhost:9 | Error Communicating with Tally, will retry next time [errors (9) <= max errors (9)] ...                
   97 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) | localhost:9 | Failed to get loaded companies from Tally                                                              
   94 [<TS>] | WARNING  | 9.9.9 (b9e9b9.9-9-9) | localhost:9 | Unable to connect to TallyPrime's server port: Is Tally Server runing at port 9?                       
   70 [<TS>] | INFO     | 9.9.9 (b9e9b9.9-9-9) |     Main Thread | Stopping adapter ...                                                                               
   58 [<TS>] | INFO     | 9.9.9 (b9af9.9-9-9) |     Main Thread | Stopping adapter ...                                                                                
   55 [<TS>] | INFO     | 9.9.9 (b9e9b9.9-9-9) |     Main Thread | Starting adapter ...                                                                               
   42 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |     Main Thread | getaddrinfo() failed. Error Code | 9                                                                
   38 [<TS>] | INFO     | 9.9.9 (b9af9.9-9-9) |     Main Thread | Exiting tray icon thread.                                                                           
   35 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |     Main Thread | Failed to call GetCredentialsAPI, retrying... (9)                                                   
   35 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |    Event Client | Connection Error: | Could not resolve hostname                                                      
   35 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |    Event Client | Failed to call GetCredentialsAPI, retrying... (9)                                                   
   35 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |     Main Thread | Connection Error: | Could not resolve hostname                                                      
   34 [<TS>] | INFO     | 9.9.9 (b9af9.9-9-9) |     Main Thread | Starting adapter ...                                                                                
   30 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |  localhost:9 | Failed to call GetCredentialsAPI, retrying... (9)                                                      
   30 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |  localhost:9 | Connection Error: | Could not resolve hostname                                                         
   29 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |  localhost:9 | Failed to get loaded companies                                                                        
   26 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |  localhost:9 | Tally API call timed out                                                                              
   25 [<TS>] | INFO     | 9.9.9 (b9e9b9.9-9-9) |     Main Thread | Exiting tray icon thread.                                                                          
   20 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) | localhost:9 | Connection Error: | Could not resolve hostname | An operation was attempted on something that is not a 
   20 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |  localhost:9 | Failed to call GetCredentialsAPI, retrying... (9)                                                     
   20 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |  localhost:9 | Connection Error: | Could not resolve hostname | An operation was attempted on something that is not a
   20 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) | localhost:9 | Failed to call GetCredentialsAPI, retrying... (9)                                                      
   20 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |  localhost:9 | Failed to get loaded companies from Tally                                                             
   20 [<TS>] | WARNING  | 9.9.9 (b9e9b9.9-9-9) |  localhost:9 | Unable to connect to TallyPrime's server port: Is Tally Server runing at port 9?                      
   19 [<TS>] | WARNING  | 9.9.9 (b9e9b9.9-9-9) |  localhost:9 | Error Communicating with Tally, will retry next time [errors (9) <= max errors (9)] ...               
   17 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |  localhost:9 | FetchLoadedCompany timed out for company: CLIENT COMPANY {COMPANY} -(9-9) - (from 9-Apr-9)               
   14 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |    Event Client | Unable to send UDP message, retrying after 9 seconds...                                            
   13 [<TS>] | WARNING  | 9.9.9 (b9af9.9-9-9) |  localhost:9 | Error deregistering company: CLIENT COMPANY {COMPANY} -(9-9) (Already deregisters?)                       
   12 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |    Event Client | Error sending UDP message: 9 | A socket operation was attempted to an unreachable network.         
   10 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |    Event Client | Error receiving UDP message, resetting receive loop ... | A blocking operation was interrupted by a
    9 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |  localhost:9 | FetchLoadedCompany timed out for company: CLIENT COMPANY {COMPANY} -(9-9)                                
    8 [<TS>] | WARNING  | 9.9.9 (b9af9.9-9-9) |     Main Thread | Error initializing UDP client OR UDP connection test failed, using SSE based communication          
    8 [<TS>] | WARNING  | 9.9.9 (b9af9.9-9-9) | localhost:9 | Error deregistering company: T.S Traders {COMPANY} - 9-9 (Already deregisters?)                            
    8 [<TS>] | WARNING  | 9.9.9 (b9af9.9-9-9) |  localhost:9 | Error deregistering company: Fame  Traders (Already deregisters?)                                      
    8 [<TS>] | WARNING  | 9.9.9 (b9af9.9-9-9) |  localhost:9 | Error deregistering company: T.S Traders {COMPANY} - 9-9 (Already deregisters?)                           
    7 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |     Main Thread | Failed to get API credentials | {"IsConnectivityError":true,"ResponseCode":9}                       
    7 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |     Main Thread | Failed to call GetCredentialsAPI                                                                    
    7 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |    Event Client | Error receiving UDP message, resetting receive loop ... | A blocking operation was interrupted by a 
    7 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |     Main Thread | Failed to get API credentials                                                                       
    7 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |    Event Client | Error registering agent with NLB                                                                    
    7 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |    Event Client | Failed to get API credentials | {"IsConnectivityError":true,"ResponseCode":9}                       
    7 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |    Event Client | Failed to get API credentials                                                                       
    7 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |    Event Client | Failed to get AWS SigV9 parameters | The parameter is incorrect.                                    
    7 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |     Main Thread | Failed to get AWS SigV9 parameters | The parameter is incorrect.                                    
    7 [<TS>] | WARNING  | 9.9.9 (b9af9.9-9-9) |     Main Thread | Error getting latest build version                                                                  
    7 [<TS>] | WARNING  | 9.9.9 (b9af9.9-9-9) |     Main Thread | Unable to check for latest build version.                                                           
    7 [<TS>] | ERROR    | 9.9.9 (b9af9.9-9-9) |    Event Client | Failed to call GetCredentialsAPI                                                                    
    6 [<TS>] | WARNING  | 9.9.9 (b9af9.9-9-9) | localhost:9 | Error deregistering company: Fame  Traders (Already deregisters?)                                       
    6 [<TS>] | WARNING  | 9.9.9 (b9af9.9-9-9) | localhost:9 | Error deregistering company: CLIENT COMPANY {COMPANY} -(9-9) (Already deregisters?)                        
    5 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |    Event Client | Failed to call GetCredentialsAPI, retrying... (9)                                                  
    5 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |     Main Thread | Connection Error: | Timeout was reached                                                            
    5 [<TS>] | ERROR    | 9.9.9 (b9e9b9.9-9-9) |     Main Thread | Failed to call GetCredentialsAPI, retrying... (9)                                                  
    5 [<TS>] | WARNING  | 9.9.9 (b9e9b9.9-9-9) | localhost:9 | Not deregistering company: Same company loaded from multiple instances of tally? | HUMA {COMPANY}.  



```
## Endpoints / hosts mentioned in agent log
```

```
## TallyPrime 7.1 tallyai.log patterns
```

Count Name                                                                                                                                                            
----- ----                                                                                                                                                            
 3852                                                                                                                                                                 
 1926 [<TS>] | ERROR    | 9.9 | UI Thread | Failed to connect to TCP server.                                                                                          
 1404 [<TS>] | ERROR    | 9.9 | UI Thread | TCPClient: Connect failed to port 9. Error: 9 | An operation on a socket could not be performed because the system lacked 
  515 [<TS>] | ERROR    | 9.9 | UI Thread | TCPClient: Connect failed to port 9. Error: 9 | No connection could be made because the target machine actively refused it
   78 [<TS>] | ERROR    | 9.9 | UI Thread | Failed to stop Tally Chat Agent. | Agent not running.                                                                     
   78 [<TS>] | ERROR    | 9.9 | UI Thread | Failed to send message to agent to stop adapter - agent not running                                                       
   34 [<TS>] | ERROR    | 9.9 | UI Thread | Failed to send company loaded event to agent process, starting agent                                                      
   29 [<TS>] | ERROR    | 9.9 | UI Thread | Failed to start Tally Chat Agent. Error:                                                                                  
   29 [<TS>] | ERROR    | 9.9 | UI Thread | Failed to start TallyAgent process and verify it is running. (We tried for 9 seconds)                                     
   23 [<TS>] | ERROR    | 9.9 | UI Thread | Unable to start agent after retries...                                                                                    
    7 [<TS>] | ERROR    | 9.9 | UI Thread | TCPClient: Connect failed to port 9. Error: 9 | Only one usage of each socket address (protocol/network address/port) is n
    2 [<TS>] | ERROR    | 9.9 | UI Thread | Invalid server port read from shared memory.Is the server initialized?                                                    
    1 [<TS>] | ERROR    | 9.9 | UI Thread | Error Login to Docs by Ira in EB: The Password is incorrect.                                                              
    1 Enter the correct Password to log in.                                                                                                                           
    1 (9 attempts remaining). Company Name: Fame  Traders. Company Connect Name: Fame  Traders. Company Guid: 9c9-9-9b9f-ba9d-f9e9e9b                                 
    1 [<TS>] | ERROR    | 9.9 | UI Thread | Failed to parse additional details from Login response                                                                    
    1 [<TS>] | ERROR    | 9.9 | UI Thread | Receive failed. Error Code | 9: A connection attempt failed because the connected party did not properly respond after a p
    1 [<TS>] | ERROR    | 9.9 | UI Thread | Unable to get session details. | 9                                                                                        
    1 [<TS>] | ERROR    | 9.9 | UI Thread | API Call failed                                                                                                           



```
