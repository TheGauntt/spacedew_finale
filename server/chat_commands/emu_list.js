"use strict";

var emu_choices = [
    'Whew.',
    'You have to push your face into it.',
    'Holy cow!',
    'What a play!',
    'Nice one!',
    'This is for you.',
    'Incoming!',
    'Siiiick!',
    'csaw',
    'Great clear!',
    "It's funny, really.",
    "BFBP",
    "GDOAT*",
    "HEH",
    "heh heh",
    "Does it... Does it say cheetos are not for your eyes?",
    "All yours.",
    "Calculated.",
    "Go for it!",
    "In position.",
    "My bad...",
    "My fault.",
    "Need boost!",
    "Nice block!",
    "No way!",
    "Okay.",
    "Oops!",
    "Savage!",
    "Run.",
    "Wait.",
    "Go!",
    "Sorry.",
    "Bye.",
    "Follow me.",
    "Thanks!",
    'Die.',
    'Die!',
    'Time to die.',
    "I'm sure it's fine.",
    "there's a couple of things I'm not going to tell you about",
    "That whole situation with the psynets was pretty weird",
    "Woboy",
    "Hoboy",
    "Hell, Cowboy.",
    "Seize the objective.",
    "Everything is fine.",
    "@_@",
    "Glorious!",
    "Yeah, you said that.",
    "Wow!",
    "Wow, that's good.",
    "Oh, brother!",
    "It's the seasoning... it's the flavor... it's the texture",
    "Girls need napkins",
    "You said that!",
    "Watch out for snakes!",
    "Who said that?",
    "gg",
    "gg wp",
    "lucky ass shit",
    "NO MAN'S SKY"
];

exports.contains = function(emu) {
    return emu_choices.indexOf(emu) >= 0;
};

exports.get = function() {
    var choices = [];
    emu_choices.sort(function(a, b) {
        return a.localeCompare(b);
    }).forEach(function(emu) {
        choices.push({
            text: emu
        })
    });

    return emu_choices;
};