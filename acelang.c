// acelang cli wrapper for windows --- .exe has to placed in bin directory

#include <stdlib.h>
#include <stdio.h>
#include <Windows.h>
#include <string.h>

#define MAX_PATH_LEN 4096

int main(int argc, char *argv[]) {
    char buffer[MAX_PATH_LEN];
    char command[MAX_PATH_LEN+50];
    char args[MAX_PATH_LEN] = "";

    if (!GetModuleFileNameA(NULL, buffer, MAX_PATH_LEN)) {
        perror("Error getting module file name");
        exit(EXIT_FAILURE);
    }

    char *last_slash = strrchr(buffer, '\\');
    if (last_slash) {
        *(last_slash + 1) = '\0';
    } else {
        buffer[0] = '\0';
    }

    for (int i = 1; i < argc; i++) {
        strcat(args, " ");
        strcat(args, argv[i]);
    }

    snprintf(command, MAX_PATH_LEN+50, "node \"%s../lib/index.js\"%s", buffer, args);

    system(command);

    return 0;
}
