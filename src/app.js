const $ = require("jquery");


var keyGiantBomb = '6077fef0f4a41cb47c253dd9aee04868f8b45282';
var searchTerm = "Witcher 3";
var title;

var split;
var documents = [];
var count = 0;
var threatCount = 15;
var threats = [];
var searchData = [];
var resourceReddit;

var blacklist = [
	'game',
	'games',
	'the',
	'it',
	'of',
	'-',
	'people',
	'giveaway',
	'poll',
	'.',
	' ',
	'',
	'just',
	'lot',
	'op',
	'times',
	'best',
	'year',
	'luck',
	'cause',
	'new',
	'gt',
	'way',
	'wii',
	'u',
	'ps4',


];



$( ".game-btn" ).on( "click", function(e) {
	e.preventDefault();
	var searchTerm = $('.game-input').val();
	var lowerCaseSearchTerm = searchTerm.toLowerCase();
	var resourceGiantBomb = 'http://www.giantbomb.com/api/search/?api_key=' + keyGiantBomb + '&format=jsonp&query=' + searchTerm + '&resources=game';
	resourceReddit = 'https://www.reddit.com/search.json?q=' + searchTerm;

	blacklist.push(lowerCaseSearchTerm.split(" "));
	blacklist.push(lowerCaseSearchTerm);
	blacklist = [].concat.apply([], blacklist);

	$.ajax({
		url: resourceGiantBomb,
		dataType: 'jsonp',
		jsonp: 'json_callback',
		success: readData
	});
});

function readData(data) {
	var game = data;
	var platforms;
	var date;

	$(game.results[0].platforms).each(function(i, platform) {

		if (i < 1) {
			platforms = platform.abbreviation + ", "
		} else if (i === game.results[0].platforms.length -1) {
			platforms = platforms + platform.abbreviation;
		} else {
			platforms = platforms + platform.abbreviation + ", ";
		}
	});

	date = game.results[0].original_release_date;

	$('.progress').removeClass('hidden');
	$('.game-window').removeClass('hidden');
	$('.game-title').append(game.results[0].name);
	$('.game-poster').attr("src", game.results[0].image.medium_url);
	$('.game-date').append("Release date: " + date);
	$('.game-platforms').append("Platforms: " + platforms);
	$('.game-description').append(game.results[0].deck);

	title = game.results[0].name;

	$('.chat').append(
		"<div class='chat-balloon chat-balloon-me'><strong>Me</strong><span>Hi friends! What do you all think of " + title + "?</span></div>"
	);

	$.ajax({
		url: resourceReddit,
		dataType: 'json',
		success: setData,
		error: errorHandler
	});
}

function errorHandler(){
	$('.chat').append(
		"<div class='chat-balloon chat-balloon-them'><strong>John</strong><span>Sorry. We're all busy. Try again later.</span></div>"
	);
}

function setData(data) {
	searchData = data;
	redditComments();
}

function redditComments() {
	var url = searchData.data.children[count].data.url + ".json";
	if( url.indexOf('reddit.com') >= 0){
		$.ajax({
			url: url,
			dataType: 'json',
			success: sortComments
		});
	} else {
		count++;
		redditComments();
	}

}

function sortComments(data) {
	documents = [];
	var increment = 100 / threatCount;
	var percent = count * increment;
	console.log(increment * count);

	$('.progress-bar').attr("aria-valuenow", percent);
	$('.progress-bar').css({
		width: percent + '%',
	});

	$(data[1].data.children).each(function (i, value) {

		value = value.data.body;
		if(value != null){
			var document = {
				"language": "en",
				"text": value
			};
			if(document.text != '') {
				documents.push(document);
			}
		} else {
		}

	});


	$(documents).each(function (i, value) {
		documents[i].id = i + 1;

		if(i === documents.length-1){
			getSentiment();
		}
	});

}

function getSentiment() {
	var params = {
		"documents": documents
	};

	$.ajax({
		method: 'POST',
		url: "https://westus.api.cognitive.microsoft.com/text/analytics/v2.0/sentiment",
		headers:{
			"Content-Type":"application/json",
			"Ocp-Apim-Subscription-Key":"e673388663d44f7587ade20642d5521c",
			"Accept":"application/json"
		},
		data: JSON.stringify(params),
		dataType: 'text',
	})
	.done(function(data) {
		var allSentiments = JSON.parse(data);
		getKeyPhrases(allSentiments);

	})
	.fail(function(data) {
		alert("error" + JSON.stringify(data));
	});
}

function getKeyPhrases(allSentiments) {
	var params = {
		"documents": documents
	};

	$.ajax({
		method: 'POST',
		url: "https://westus.api.cognitive.microsoft.com/text/analytics/v2.0/keyPhrases",
		headers:{
			"Content-Type":"application/json",
			"Ocp-Apim-Subscription-Key":"e673388663d44f7587ade20642d5521c",
			"Accept":"application/json"
		},
		data: JSON.stringify(params),
		dataType: 'text',
	})
	.done(function(data) {
		var allKeyPhrases = JSON.parse(data);
		buildDataSet(allSentiments, allKeyPhrases);

	})
	.fail(function(data) {
		alert("error" + JSON.stringify(data));
	});
}

function buildDataSet(allSentiments, allKeyPhrases) {
	var userData = [];
	$(documents).each(function (i, value) {
		if (allKeyPhrases.documents[i] != null && allSentiments.documents[i].score != null && allSentiments.documents[i].score != 0.5 && allSentiments.documents[i].score < 1) {
			userData.push({
				text: value.text,
				keywords: allKeyPhrases.documents[i].keyPhrases,
				sentiment: allSentiments.documents[i].score
			});
		}
	});
	threats = threats.concat(userData);
	count++;

	if (count < threatCount) {
		redditComments();
	} else {
		var completeRating = 0;
		$('.progress-bar').attr("aria-valuenow", 100);
		$('.progress-bar').css({
			width: '100%',
		});


		$(threats).each(function (i, value) {
			completeRating = completeRating + value.sentiment;
		});
		completeRating = completeRating / threats.length;

		filterContent(completeRating);
	}
}

function filterContent(completeRating) {
	var posCount = 0;
	var negCount = 0;
	var posPercentage;
	var negPercentage;
	var onePercent;
	var keyCollection = [];
	var negativeKeyList = [];
	var positiveKeyList = [];
	var splitWords;

	$(threats).each(function(i, value) {
		if(value.sentiment > 0.8) {
			posCount++;
			threats[i].positive = 1;
		} else if (value.sentiment < 0.2) {
			negCount++;
			threats[i].negative = 1;
		}

		$(value.keywords).each(function(i, key) {
			keyCollection.push(key.toLowerCase());
			if(value.sentiment > 0.9) {
				positiveKeyList.push(key.toLowerCase().split(" "));
			} else if (value.sentiment < 0.1) {
				negativeKeyList.push(key.toLowerCase().split(" "));
			}
			$('#keywords').append('<li>' + key + '</li>');
		});
	});

	positiveKeyList = [].concat.apply([], positiveKeyList);
	negativeKeyList = [].concat.apply([], negativeKeyList);


	onePercent = ((posCount + negCount) / 100);
	posPercentage = posCount / onePercent;
	negPercentage = negCount / onePercent;

	buildApprovalBar(posPercentage, negPercentage);
	makeTweet(posPercentage, positiveKeyList, negativeKeyList);
}

function buildApprovalBar(posPercentage, negPercentage) {
	$('#rating').css({
		width: '100%',
		height: '250px'
	});

	$('#positive').css({
		width: Math.floor(posPercentage) + '%',
		height: '100px',
		margin: '0',
		"background-color": 'green'
	});

	$('#negative').css({
		width: Math.floor(negPercentage) + '%',
		height: '100px',
		margin: '0',
		"background-color": 'red'
	});
}

function makeTweet(percentage, pos, neg) {
	var intro;
	var firstBody;
	var foundWords = [];
	var uniqueWords = [];
	var foundWordsCount = [];
	var keyArray = [];
	var friends = [];

	if(percentage < 30) {
		intro = "Man, " + searchTerm + " is really bad.";
	} else if (percentage < 50) {
		intro = "Not really too enthusiastic about " + searchTerm + ".";
	} else if (percentage < 70) {
		intro = searchTerm + " is quite enjoyable.";
	} else if (percentage < 100) {
		intro = "Wow, " + searchTerm + " is really great!";
	}

	if(percentage < 50) {
		keyArray = neg;
	} else {
		keyArray = pos;
	}

	var negativeArray = [];
	var positiveArray = [];
	var negCount = [];
	var posCount = [];

	$(neg).each(function(i, foundWord) {
		var thisCount = wordCount(neg, foundWord);
		if($.inArray(foundWord, negativeArray) !== -1) {
		} else if ($.inArray(foundWord, blacklist) !== -1) {
		} else {
			negCount.push(thisCount);
		}
		negativeArray.push(foundWord);

		//allWordCount.push(wordCount(foundWords, foundWord));
	});

	$(pos).each(function(i, foundWord) {
		var thisCount = wordCount(pos, foundWord);
		if($.inArray(foundWord, positiveArray) !== -1) {
		} else if ($.inArray(foundWord, blacklist) !== -1) {
		} else {
			posCount.push(thisCount);
		}
		positiveArray.push(foundWord);

		//allWordCount.push(wordCount(foundWords, foundWord));
	});


	negCount.sort(function (a, b) {
		return a.number - b.number;
	});

	posCount.sort(function (a, b) {
		return a.number - b.number;
	});

	var percentThreshold = Math.floor(percentage / 10) * 10;
	for (var i = 0; i < 5; i++) {
		percentThreshold = percentThreshold + 20;

		if(percentThreshold < 100) {
			friends.push({
				name: randomName(),
				message: randomIntro('negative') + title + randomBody('negative') + 'This is because of ' + negCount[negCount.length - 1].keyword + ' and ' + negCount[negCount.length - 2].keyword + '.'
			});
			negCount.pop();
			negCount.pop();
		} else {
			friends.push({
				name: randomName(),
				message: randomIntro('positive') + title + randomBody('positive') + 'I think this is because of ' + posCount[posCount.length - 1].keyword + ' and ' + posCount[posCount.length - 2].keyword + '.'
			});
			posCount.pop();
			posCount.pop();
		}

	}

	friends.sort(function() {
		return 0.5 - Math.random();
	});

	$(friends).each(function(i, friend) {

		(function(ind) {
			setTimeout(function(){
				$('.chat').append(
					"<div class='chat-balloon chat-balloon-them'><strong>" + friend.name + "</strong><span>" + friend.message + "</span></div>"
				);
			}, 1000 + (3000 * ind));
		})(i);
	});



	console.log(friends);


	// for (var i = 0; i < 10; i++) {
	// 	$('#results').append('<tr><td>' + foundWordsCount[foundWordsCount.length - 1 - i].keyword + '</td><td>' + foundWordsCount[foundWordsCount.length - 1 - i].number + '</td></tr>');
	// }
}

function wordCount(array, what) {
	var count = 0;
	for (var i = 0; i < array.length; i++) {
		if (array[i] === what) {
			count++;
		}
	}
	return {
		keyword: what,
		number: count
	};
}

function randomName() {
	var names = [
		'Arjen',
		'Ed',
		'James',
		'Tommy',
		'Thomas',
		'Simone',
		'Nils',
		'Tobias',
		'Hansi',
		'Mike',
		'Russell',
		'Michael',
		'Floor',
		'Jeremy',
		'Czar',
		'Jens',
		'Marijn',
		'Jordan',
		'John',
		'Freddie',
		'Roger',
		'Brian',
		'Don',
		'Vito',
		'Lee',
		'Clint',
		'Howard',
		'Lennart',
		'Jasper',
		'Matthijs',
		'Nico',
		'Arie',
		'Bente',
		'Willemijn',
		'Rowan',
		'Samantha',
		'Lars',
		'Roza',
		'Uma',
		'Irene',
		'Scarlett',
		'Misha',
		'Milan',
		'Sarah',
		'Robin',
		'Bas',
		'Kim',
		'Maggie',
		'Marleen',
		'Marlijn',
		'Bart',
		'Doortje',
		'Bram',
		'Laurens',
		'Tom',
		'Beau',
		'Jonathan',
		'Samira',
		'Youssry',
		'Felix',
		'Giel',
		'Daryl',
		'Duncan',
		'Andreas',
		'Megan',
		'Rosalie',
		'Rosa',
		'Cynthia',
		'Anouk',
		'Liona',
		'Lindsey',
		'Leanne',
		'Ilse',
		'Jolanda',
		'Marianne',
		'Maks',
		'Liza',
		'Laura',
		'Tim',
		'Rob',
		"Dieuwertje",
		"Antwan",
		"Emiel",
		"Martijn"
	];

	return names[Math.floor(Math.random() * names.length)];
}

function randomIntro(opinion) {
	var intro = [];
	if(opinion === 'negative') {
		intro = [
			"Hmm, well, I wouldn't say it's one of my favorites. ",
			"Not really a fan I'm afraid. ",
			"Really? I hate that game. ",
			"It sucks. ",
			"Skip. ",
			"Do not buy. ",
			"There are so many actually good games out there. You shouldn't waste your cash on this one though. ",
			"Do not like. ",
			"Meh. ",
			"Not that game! ",
			"Not your best choice buddy. ",
			"I don't like it. ",
			"I do not like it." ,
			"I hate it. ",
			"It's bad. ",
			"It's not good. ",
			"It ain't good. ",
			"It's a bad game. ",
			"That's not a good game. ",
			"That's not a great game. "
		]
	} else if (opinion === 'positive') {
		intro = [
			"It's dope. ",
			"I like that game! ",
			"It's one of my favourites. ",
			"Buy! ",
			"Such a good game. ",
			"Fantastic title. ",
			"Yeah, you really should buy that. ",
			"I recommend it. ",
			"Yeah boiii. ",
			"It's amazing! ",
			"It's a good game. ",
			"It's a great game.",
			"I like it. ",
			"I can recommend it. ",
			"It's nice. ",
			"It's pretty good. ",
			"It's a lot of fun. ",
			"Yeah I like it. ",
			"Great game. ",
		]
	}

	return intro[Math.floor(Math.random() * intro.length)];
}

function randomBody(opinion) {
	var body = [];
	if(opinion === 'negative') {
		body = [
			" is just really not worth your time. ",
			" doesn't deliver. Better play something else. ",
			" is a piece of trash. ",
			" will not please you. ",
			" will make you rage. ",
			" is one of those games that look good on paper but lack in execution. ",
			" makes me angry. ",
			" is a bad game. ",
			" is not a good game. ",
			" is a pretty bad game. ",



		]
	} else if (opinion === 'positive') {
		body = [
			" is such a joy to play. ",
			" fills my heart with determination. ",
			" will put a smile on your face. ",
			" is just your thing. ",
			" should be played. ",
			" is one of the better games I played ",
			" is fun ",
			" is nice ",
			" is a sight to behold ",
		]
	}
	return body[Math.floor(Math.random() * body.length)];
}
