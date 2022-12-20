#include <stdio.h>
#include <windows.h>

typedef struct {
    size_t size;
    HANDLE *array;
    int cursor;
} ThreadList;

typedef struct {
    LPVOID result;
    LPVOID param;
} PARAM;

ThreadList mallocThreadList() {

    size_t thread_size = 1000;
    const HANDLE array = malloc(thread_size * sizeof(HANDLE));

    ThreadList threads = {
        .size = thread_size,
        .array = array,
        .cursor = 0
    };

    return threads;
}

void reallocThreadList(ThreadList *threads) {
    threads->size *= 2;
    threads->array = realloc(threads->array, threads->size * sizeof(HANDLE));
}

void waitForThreads(ThreadList *threads) {
    for (size_t i = 0; i < threads->size; i++)
    {
        const HANDLE thread = threads->array[i];
        if(thread != NULL)
            WaitForSingleObject(thread, INFINITE);
    }
}

HANDLE createThread(ThreadList *threads, LPTHREAD_START_ROUTINE routine, LPVOID param, LPVOID result) {
    PARAM _param = {
        .param = param,
        .result = result,
    };
    const HANDLE thread = CreateThread(NULL, 0, routine, &_param, 0, NULL);
    threads->array[threads->cursor++] = thread;
    return thread;
}