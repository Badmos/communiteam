$(document).ready(function() {
    $('li.dashboard-item').hover(function() {
        $(this).css('background-color', '#03213d')
    }, function() {
        $(this).css('background-color', '#011B32')
    });
});