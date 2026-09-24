#include <stdio.h>
#include <signal.h>
#include <unistd.h>

static volatile sig_atomic_t running = 1;
static void stop_handler(int sig) { (void)sig; running = 0; }

int main(void) {
    signal(SIGTERM, stop_handler);
    signal(SIGINT, stop_handler);
    puts("ALICE OS native init 13.2");
    puts("[alice-init] native userspace boundary online");
    puts("[alice-init] hardware discovery: read-only");
    puts("[alice-init] desktop runtime: delegated to Alice local service");
    puts("[alice-init] security: owner-controlled / offline-first");
    fflush(stdout);
    while (running) sleep(1);
    puts("[alice-init] shutdown requested");
    return 0;
}
