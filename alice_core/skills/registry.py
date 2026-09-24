def get_skills():
    return [
        {"id":"system_monitor","name":"System Monitor","status":"ready","mode":"offline"},
        {"id":"file_assistant","name":"File Assistant","status":"ready","mode":"offline"},
        {"id":"terminal","name":"Terminal","status":"ready","mode":"offline"},
        {"id":"locator","name":"Locator","status":"permission-based","mode":"local"},
        {"id":"translator","name":"Translator","status":"ready","mode":"offline"},
        {"id":"notes","name":"Notes","status":"ready","mode":"offline"},
        {"id":"media","name":"Media Controller","status":"adapter","mode":"local"},
        {"id":"security_lab","name":"Security Lab","status":"defensive-only","mode":"offline"},
        {"id":"voice","name":"Voice","status":"adapter","mode":"offline"},
        {"id":"ai_orchestrator","name":"AI Orchestrator","status":"offline-fallback","mode":"offline"},
        {"id":"projection","name":"Projection","status":"adapter","mode":"local"},
        {"id":"devices","name":"Device Hub","status":"adapter","mode":"local"},
        {"id":"wallet","name":"Wallet Vault","status":"local-records-only","mode":"offline"},
    ]
