package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.Role;
import java.time.Instant;
import java.util.List;

public final class NotationDto {
    private NotationDto() { }
    public record Demande(Role cible, Integer note, String commentaire) { }
    public record NoteVue(Role cible, int note, String commentaire, Instant date) { }
    public record NotesVue(boolean ouverte, List<Role> cibles, List<NoteVue> notes) { }
}
