function broadcastToClients(matchId: string, event: string, payload: any) {
    // Socket.IO broadcast (if available). We emit to room = matchId
    try {
        if (io && matchId) {
            io.to(matchId).emit(event, payload);
        }
    } catch (e) {
        console.warn("Socket.IO emit failed", e);
    }
}